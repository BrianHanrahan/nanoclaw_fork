# Fitness Tracker Setup - Port Forwarding Options

## The Problem
The server runs inside a Docker container, so localhost from your browser can't reach it.

## Solution 1: Run on Host (Easiest)
1. Open terminal on your HOST machine (not in Docker)
2. Navigate to: `groups/main/fitness-tracker/`
3. Run: `python3 server.py`
4. Access at: http://localhost:5050
5. From phone: http://[your-network-ip]:5050

## Solution 2: Docker Port Forwarding
Add port mapping when starting the NanoClaw container:

### Using docker run:
```bash
docker run -p 5050:5050 [other-options] [image-name]
```

### Using docker-compose:
Add to your docker-compose.yml:
```yaml
services:
  nanoclaw:
    ports:
      - "5050:5050"
```

Then restart the container and I can run the server inside.

## Solution 3: ngrok (For Remote Access)
If you want to access from anywhere (not just local network):

1. Install ngrok: https://ngrok.com/download
2. Run the server on host (Solution 1)
3. In another terminal: `ngrok http 5050`
4. Use the ngrok URL from anywhere

## Recommendation
Use **Solution 1** - it's simplest and works great for local/network access.
