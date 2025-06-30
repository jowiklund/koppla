package auth

type Credentials struct {
	Username string `db:"username" json:"username"`
	Password string `db:"password" json:"password"`
}

type User struct {
	Id    string `db:"id" json:"id"`
	Name  string `db:"name" json:"name"`
	Email string `db:"email" json:"email"`
}
