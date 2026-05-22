package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/relay/runtime/internal/callback"
	"github.com/relay/runtime/internal/server"
	"github.com/relay/runtime/internal/tools"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "4100"
	}

	controlPlaneURL := os.Getenv("CONTROL_PLANE_URL")
	if controlPlaneURL == "" {
		controlPlaneURL = "http://localhost:4000"
	}
	internalSecret := os.Getenv("RELAY_INTERNAL_SECRET")
	cb := callback.New(controlPlaneURL, internalSecret)

	registry := tools.DefaultRegistry()

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: server.New(registry, cb),
	}

	go func() {
		log.Printf("[runtime] listening on http://localhost:%s", port)
		log.Printf("[runtime] callback target: %s", controlPlaneURL)
		if internalSecret == "" {
			log.Println("[runtime] RELAY_INTERNAL_SECRET not set (callback unauthenticated)")
		}
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("[runtime] shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}
