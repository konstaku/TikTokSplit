# TikTok Blend App

A web application that automatically downloads the top 3 trending TikTok videos, merges them into a single blended video with synchronized audio, and overlays daily breaking news headlines. Built with the MERN stack (MongoDB, Express, React, Node.js) and TypeScript.

## Features

- **Automated TikTok Scraping**: Fetches the top 3 trending TikTok videos daily from TikViewer
- **Video Merging**: Blends three videos with:
  - Different playback speeds (2x, 1.5x, 1.25x)
  - 33% opacity overlay for each video
  - Synchronized audio mixing
  - Continuous looping to ensure all videos play for at least 30 seconds
- **News Overlays**: Inserts breaking news headlines and images at 5-second intervals
- **Mobile-First Design**: TikTok-like vertical video player with swipe navigation
- **7-Day Archive**: Swipe through the last 7 days of blended videos

## Tech Stack

### Backend
- **Node.js** with **TypeScript**
- **Express.js** - REST API server
- **MongoDB** with **Mongoose** - Database
- **Puppeteer** - Browser automation for scraping
- **FFmpeg** (via fluent-ffmpeg) - Video processing and merging
- **Cheerio** - HTML parsing
- **Axios** - HTTP requests
- **node-cron** - Scheduled tasks

### Frontend
- **React** with **TypeScript**
- Mobile-first responsive design

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- FFmpeg installed on your system
  ```bash
  # macOS
  brew install ffmpeg
  
  # Ubuntu/Debian
  sudo apt-get install ffmpeg
  
  # Windows
  # Download from https://ffmpeg.org/download.html
  ```

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd tiktok-blend-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the project root:
   ```env
   MONGO_URI=mongodb://localhost:27017/tiktok-blend
   PORT=5050
   ```

4. **Start MongoDB** (if using local instance)
   ```bash
   # macOS with Homebrew
   brew services start mongodb-community
   
   # Or run directly
   mongod --dbpath /usr/local/var/mongodb
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

   The server will start on `http://localhost:5050`

## Usage

### Generate a Blended Video

Send a POST request to generate a blended video for a specific date:

```bash
curl -X POST http://localhost:5050/api/video/2025-11-07/generate
```

**Response:**
```json
{
  "success": true,
  "url": "/public/blend_2025-11-07.mp4"
}
```

### API Endpoints

- `GET /api/health` - Health check endpoint
- `GET /api/video/:date` - Get video info for a date
- `POST /api/video/:date/generate` - Generate blended video for a date
- `GET /api/news/today` - Get today's news (stub)

### Debug Mode

Enable debug mode to dump HTML files during scraping:

```bash
export DEBUG_SCRAPE=1
npm run dev
```

Debug files will be saved to `backend/public/tmp/<date>/`

## Project Structure

```
tiktok-blend-app/
├── backend/
│   ├── src/
│   │   ├── scrapers/
│   │   │   ├── tiktok.ts          # TikTok video scraping
│   │   │   ├── news.ts            # News headline scraping
│   │   │   ├── trending.ts        # Trending page extraction
│   │   │   ├── detail.ts          # Video detail page MP4 extraction
│   │   │   ├── browser.ts         # Browser automation helpers
│   │   │   ├── constants.ts       # Scraper constants
│   │   │   └── logger.ts          # Debug logging
│   │   ├── videoProcessing/
│   │   │   └── mergeVideos.ts     # FFmpeg video merging logic
│   │   ├── routes/
│   │   │   ├── video.ts           # Video API routes
│   │   │   └── news.ts            # News API routes
│   │   ├── utils/
│   │   │   └── download.ts        # File download utility
│   │   └── models/                # MongoDB models (future)
│   ├── public/
│   │   └── tmp/                   # Temporary video storage
│   ├── types/
│   │   └── fluent-ffmpeg.d.ts     # TypeScript definitions
│   └── server.ts                  # Express server entry point
├── frontend/                       # React app (to be implemented)
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

1. **Scraping**: Uses Puppeteer to fetch trending TikTok videos from TikViewer
2. **MP4 Extraction**: Resolves direct MP4 URLs from video detail pages
3. **Download**: Downloads the 3 videos to temporary storage
4. **Processing**: Uses FFmpeg to:
   - Apply speed adjustments (2x, 1.5x, 1.25x)
   - Scale and pad videos to 1080x1920
   - Loop videos infinitely
   - Overlay with 33% opacity
   - Mix audio tracks
   - Cut to 30 seconds
5. **Output**: Saves merged video to `backend/public/blend_<date>.mp4`

## Development

### Scripts

- `npm run dev` - Start development server with auto-reload (nodemon)
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server

### TypeScript

The project uses TypeScript for both backend and frontend. Configuration is in `tsconfig.json`.

## Future Improvements

- [ ] Implement news RSS scraping (CNN, AP, Reuters)
- [ ] Add news image overlays with fade effects
- [ ] Implement daily cron job for automatic video generation
- [ ] Add MongoDB models for video metadata storage
- [ ] Build React frontend with swipe navigation
- [ ] Add video caching to avoid re-processing
- [ ] Implement user authentication
- [ ] Add video sharing functionality

## Troubleshooting

### "Cannot find ffmpeg" error
Make sure FFmpeg is installed and available in your PATH:
```bash
ffmpeg -version
```

### "No input specified" error
Check that video files exist in `backend/public/tmp/<date>/` after downloading.

### MongoDB connection errors
Ensure MongoDB is running and the `MONGO_URI` in `.env` is correct.

### Video freezing on first frame
This was resolved by using the `loop` filter with proper buffer size. If it recurs, check FFmpeg version compatibility.

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
