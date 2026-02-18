# Brian's Fitness Tracker Web App

A clean, networked web app to track your 4-day strength & conditioning program. Access from any device on your network!

## Features

✓ **Track Daily Workouts** - Check off exercises as you complete them
✓ **Weekly View** - See your full week at a glance
✓ **Progress Stats** - Track this week's progress, total workouts, and current streak
✓ **Add Notes** - Record weights used, PRs, and how you felt
✓ **Navigate Weeks** - View past workouts and plan ahead
✓ **Multi-Device Access** - Use from your phone, tablet, or computer
✓ **Frank Can See Your Progress** - Data synced to server for AI tracking

## Quick Start

```bash
cd /workspace/group/fitness-tracker
python3 server.py
```

The server will display URLs to access the app:
- **From this computer:** http://localhost:5050
- **From your phone/tablet:** http://[your-ip]:5050

## Your Program

### Monday - Upper Body Strength
Chest, Shoulders, Triceps (~40 min)

### Tuesday - Lower Body Strength
Legs, Glutes, Core (~45 min)

### Wednesday - Cardio + Functional Training
Cardio Endurance, Functional Movement (~40 min)

### Thursday - Upper Body Pull + Core
Back, Biceps, Rear Delts (~40 min)

### Friday-Sunday - Rest/Active Recovery
Light surfing, biking, walking, stretching

## How Data Works

All workout data is saved to `/workspace/group/fitness-data.json`:
- Exercise completions
- Workout completions
- Notes and observations
- Historical tracking

**Benefits:**
- Frank can read this file to track your progress
- Works across all your devices on the network
- Data persists even if server restarts
- Can be backed up or exported easily

## Mobile Access

### Find Your Server's IP Address
The server displays your IP when it starts. It looks like: `192.168.x.x` or `10.0.x.x`

### On Your iPhone/iPad:
1. Open Safari
2. Go to `http://[server-ip]:5050` (use the IP from server startup)
3. Bookmark it or add to home screen

### Add to iOS Home Screen:
1. Open the app in Safari
2. Tap the Share button (square with arrow)
3. Tap "Add to Home Screen"
4. Name it "Workout Tracker"
5. Tap "Add"

Now you have a dedicated app icon!

## What Frank Can Track

When you complete workouts and exercises, Frank can see:
- Which exercises you finished
- Your consistency patterns
- Notes and PRs you record
- Weekly and total progress
- Your workout streaks

This helps Frank:
- Give personalized daily reminders
- Adjust future recommendations
- Celebrate milestones
- Provide better coaching

## API Endpoints

The server provides these endpoints:
- `GET /api/workouts` - Get all workout data
- `GET /api/workouts/{date}` - Get specific date's workout
- `POST /api/workouts/{date}` - Save workout for date
- `GET /api/stats` - Get overall statistics

## Troubleshooting

**Can't connect from phone?**
- Make sure your phone is on the same WiFi network
- Check the IP address matches what the server displays
- Try http:// not https://

**Server stops working?**
- Restart it with `python3 server.py`
- Data is saved, so you won't lose progress

**Want to run it permanently?**
Ask Frank to set it up as a background service!

## Start Date

Week of February 17, 2026

## Technical Details

- Pure Python (no external dependencies required)
- Uses Python's built-in `http.server` and `socketserver`
- Data stored in JSON format
- CORS enabled for cross-origin requests
- Runs on port 5050
- Accessible on all network interfaces (0.0.0.0)
