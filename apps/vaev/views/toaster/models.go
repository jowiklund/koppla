package toaster

import (
	"fmt"
	"time"

	datastar "github.com/starfederation/datastar/sdk/go"
)

func SendErrorMessage(sse *datastar.ServerSentEventGenerator, msg string) {
	time := time.Now()
	sse.MergeFragmentTempl(
		ErrorMessage(msg, fmt.Sprint(time.UnixMilli())),
		datastar.WithMergeMode(datastar.FragmentMergeModeAppend),
		datastar.WithSelectorID("toaster"),
	)
}
