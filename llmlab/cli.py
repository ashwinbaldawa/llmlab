"""CLI entry point for llmlab."""

import argparse
import webbrowser
import threading


def main():
    parser = argparse.ArgumentParser(
        prog="llmlab",
        description="LLMLab - Unified LLM testing lab",
    )
    parser.add_argument("--port", type=int, default=8000, help="Port to run on (default: 8000)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to bind to (default: 127.0.0.1)")
    parser.add_argument("--no-browser", action="store_true", help="Don't open browser automatically")
    args = parser.parse_args()

    import uvicorn

    url = f"http://{args.host}:{args.port}"

    if not args.no_browser:
        # Open browser after a short delay to let the server start
        threading.Timer(1.5, lambda: webbrowser.open(url)).start()

    print(f"\n  LLMLab v0.1.0")
    print(f"  Running at {url}")
    print(f"  Press Ctrl+C to stop\n")

    uvicorn.run(
        "llmlab.server:app",
        host=args.host,
        port=args.port,
        log_level="warning",
    )


if __name__ == "__main__":
    main()
