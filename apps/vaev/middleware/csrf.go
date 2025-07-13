package middleware

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

const (
	SESSION_COOKIE_NAME = "app_session"
	CSRF_TOKEN_FIELD    = "CSRF-Token"
)

var session_key = os.Getenv("SESSION_KEY")

type SessionData struct {
	UserID    string `db:"user_id" json:"user_id"`
	CSRFToken string `db:"csrf_token" json:"csrf_token"`
	ExpiresAt int64  `db:"expires_at" json:"expires_at"`
}

const cookie_age = time.Hour * 24 * 30

func SignData(data []byte) []byte {
	h := hmac.New(sha256.New, []byte(session_key))
	h.Write(data)
	return h.Sum(nil)
}

func EncodeSignedCookie(data SessionData) (string, error) {
	json_data, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("Unable to marshal session data: %w", err)
	}

	signature := SignData(json_data)

	payload := append(json_data, signature...)

	return base64.URLEncoding.EncodeToString(payload), nil
}

func DecodeSignedCookie(encoded string) (SessionData, bool) {
	decoded_payload, err := base64.URLEncoding.DecodeString(encoded)
	if err != nil {
		log.Printf("Failed to base64 decode session cookie: %v", err)
		return SessionData{}, false
	}

	signature_len := sha256.Size
	if len(decoded_payload) < signature_len {
		log.Println("Session cookie too short to contain signature")
		return SessionData{}, false
	}

	json_data := decoded_payload[:len(decoded_payload)-signature_len]
	received_signature := decoded_payload[len(decoded_payload)-signature_len:]

	expected_signature := SignData(json_data)
	if !hmac.Equal(received_signature, expected_signature) {
		log.Println("Session cookie signature mismatch")
		return SessionData{}, false
	}

	var data SessionData
	if err := json.Unmarshal(json_data, &data); err != nil {
		log.Printf("Failed to unmarshal json: %v", err)
		return SessionData{}, false
	}

	if data.ExpiresAt != 0 && time.Now().Unix() > data.ExpiresAt {
		log.Println("Session cookie expired")
		return SessionData{}, false
	}

	return data, true
}

func generateCSRFToken() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", fmt.Errorf("Failed to generate csrf token: %w", err)
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

func WithCSRF(next http.Handler) http.Handler {
	fn := func(w http.ResponseWriter, r *http.Request) {
		var session_data SessionData
		var current_csrf_token string

		cookie, err := r.Cookie(SESSION_COOKIE_NAME)
		if err == nil {
			sd, ok := DecodeSignedCookie(cookie.Value)
			if ok {
				session_data = sd
				current_csrf_token = sd.CSRFToken
			}
		}

		if current_csrf_token == "" {
			new_token, err := generateCSRFToken()
			if err != nil {
				log.Printf("Error generating new CSRF token: %v", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
			session_data.CSRFToken = new_token
			session_data.ExpiresAt = time.Now().Add(cookie_age).Unix()
			current_csrf_token = new_token
		}

		if r.Method != http.MethodGet &&
			r.Method != http.MethodHead &&
			r.Method != http.MethodOptions {
			if r.Header.Get("Content-Type") == "application/x-www-form-urlencoded" ||
				r.Header.Get("Content-Type") == "multipart/form-data" {
				r.ParseMultipartForm(1024 * 1024)
			}

			client_token := r.FormValue(CSRF_TOKEN_FIELD)
			if client_token == "" {
				client_token = r.Header.Get("X-" + CSRF_TOKEN_FIELD)
			}

			if client_token == "" {
				log.Printf("CSRF token missing for %s %s", r.Method, r.URL.Path)
				http.Error(w, "CSRF token missing", http.StatusForbidden)
				return
			}

			if !hmac.Equal([]byte(client_token), []byte(current_csrf_token)) {
				log.Printf("Invalid CSRF token for %s %s. Client: %s, Expected: %s",
					r.Method, r.URL.Path, client_token, current_csrf_token)
				http.Error(w, "Invalid CSRF token", http.StatusForbidden)
				return
			}
		}

		encoded_session, err := EncodeSignedCookie(session_data)
		if err != nil {
			log.Printf("Error encoding session cookie: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		http.SetCookie(w, &http.Cookie{
			Name:     SESSION_COOKIE_NAME,
			Value:    encoded_session,
			Path:     "/",
			Expires:  time.Now().Add(cookie_age),
			HttpOnly: true,
			Secure:   true,
			SameSite: http.SameSiteStrictMode,
		})

		next.ServeHTTP(w, r)
	}
	return http.HandlerFunc(fn)
}
