package callback

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	baseURL  string
	secret   string
	http     *http.Client
}

func New(baseURL, secret string) *Client {
	return &Client{
		baseURL: baseURL,
		secret:  secret,
		http:    &http.Client{Timeout: 35 * time.Second},
	}
}

func (c *Client) WaitToolResult(ctx context.Context, runID, toolUseID string) (any, error) {
	url := fmt.Sprintf("%s/internal/runs/%s/tool-result/%s", c.baseURL, runID, toolUseID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	if c.secret != "" {
		req.Header.Set("authorization", "Internal "+c.secret)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		var errPayload struct {
			Error string `json:"error"`
		}
		_ = json.Unmarshal(body, &errPayload)
		if errPayload.Error != "" {
			return nil, fmt.Errorf("callback %d: %s", resp.StatusCode, errPayload.Error)
		}
		return nil, fmt.Errorf("callback %d: %s", resp.StatusCode, string(body))
	}

	var payload struct {
		Output any `json:"output"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("decode callback body: %w", err)
	}
	return payload.Output, nil
}
