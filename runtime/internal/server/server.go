package server

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/relay/runtime/internal/agent"
	"github.com/relay/runtime/internal/callback"
	"github.com/relay/runtime/internal/tools"
)

func New(registry *tools.Registry, cb *callback.Client) http.Handler {
	mux := http.NewServeMux()
	runner := agent.NewRunner(registry, cb)

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"providers":["anthropic","openai"]}`))
	})

	mux.HandleFunc("POST /runs", func(w http.ResponseWriter, r *http.Request) {
		var req agent.RunRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json: "+err.Error(), http.StatusBadRequest)
			return
		}
		if req.Model == "" || req.Input == "" {
			http.Error(w, "model and input are required", http.StatusBadRequest)
			return
		}
		if req.Credentials == nil || req.Credentials.APIKey == "" {
			http.Error(w, "credentials are required", http.StatusBadRequest)
			return
		}

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}

		w.Header().Set("content-type", "text/event-stream")
		w.Header().Set("cache-control", "no-cache, no-transform")
		w.Header().Set("connection", "keep-alive")
		w.WriteHeader(http.StatusOK)

		var mu sync.Mutex
		emit := func(evt agent.Event) {
			mu.Lock()
			defer mu.Unlock()
			payload, err := json.Marshal(evt)
			if err != nil {
				log.Printf("[runtime] marshal event: %v", err)
				return
			}
			if _, err := w.Write([]byte("data: ")); err != nil {
				return
			}
			if _, err := w.Write(payload); err != nil {
				return
			}
			if _, err := w.Write([]byte("\n\n")); err != nil {
				return
			}
			flusher.Flush()
		}

		runner.Run(r.Context(), req, emit)
	})

	return mux
}
