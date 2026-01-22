# Latent Space - Puzzle Section

A puzzle challenge section for mahbod.me with Win98 theming, powered by Supabase.

## Setup Instructions

### 1. Supabase Configuration

#### a) Run the Database Schema
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Open your project
3. Navigate to **SQL Editor** (in the left sidebar)
4. Create a new query and paste the contents of `supabase-schema.sql`
5. Click **Run** to execute

#### b) Enable Google Authentication
1. In Supabase Dashboard, go to **Authentication** > **Providers**
2. Find **Google** and enable it
3. You'll need Google OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create or select a project
   - Go to **APIs & Services** > **Credentials**
   - Create **OAuth 2.0 Client ID** (Web application)
   - Add authorized redirect URI: `https://begtzhbfsvntrqaxjmah.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client Secret** to Supabase

#### c) Configure Site URL
1. In Supabase Dashboard, go to **Authentication** > **URL Configuration**
2. Set **Site URL** to: `https://mahbod.me`
3. Add to **Redirect URLs**:
   - `https://mahbod.me/latent-variable/`
   - `https://mahbod.me/latent-variable/index.html`

### 2. Adding Puzzles

To add a new puzzle, you need to insert it into the Supabase database.

#### a) Generate Answer Hash
First, hash your answer (lowercase, trimmed) using SHA-256:
```bash
echo -n "your answer here" | sha256sum
```
Or use an online tool: https://emn178.github.io/online-tools/sha256.html

#### b) Insert Puzzle
In Supabase SQL Editor:
```sql
INSERT INTO puzzles (id, title, description, answer_hash, release_time, base_points)
VALUES (
    1,
    'Your Puzzle Title',
    'Your puzzle description with <b>HTML</b> formatting allowed...',
    'your_sha256_hash_here',
    '2026-01-25 12:00:00+00',  -- Release time (UTC)
    1000  -- Base points
);
```

#### c) Add Hints
```sql
INSERT INTO hints (puzzle_id, hint_text, release_time)
VALUES 
    (1, 'First hint text...', '2026-01-26 12:00:00+00'),
    (1, 'Second hint text...', '2026-01-27 12:00:00+00'),
    (1, 'Third hint text...', '2026-01-28 12:00:00+00');
```

### 3. Adding New Puzzle Pages

For each new puzzle, create a new HTML file (e.g., `puzzle-002.html`):

1. Copy `puzzle-001.html`
2. Rename to `puzzle-002.html`
3. Update the `PUZZLE_ID` constant at the bottom:
```javascript
const PUZZLE_ID = 2;
```
4. Update the title and footer section number

## File Structure

```
/latent-variable/
├── index.html          # Landing page with puzzle list
├── login.html          # Google login page
├── leaderboard.html    # Leaderboard display
├── puzzle-001.html     # First puzzle page
├── styles.css          # Win98-themed CSS
├── scripts.js          # Supabase integration & logic
├── supabase-schema.sql # Database schema
└── README.md           # This file
```

## Scoring System

- Each puzzle has a base point value
- Score = Base Points / 2^(hints_released)
- Examples:
  - 0 hints: 1000 points
  - 1 hint: 500 points
  - 2 hints: 250 points
  - 3 hints: 125 points

## Database Tables

### users
- `id` - UUID (from Supabase Auth)
- `username` - Display name
- `email` - User email
- `avatar_url` - Profile picture
- `created_at` - Registration date

### puzzles
- `id` - Puzzle number
- `title` - Puzzle title
- `description` - HTML description
- `answer_hash` - SHA-256 hash of answer
- `release_time` - When puzzle becomes available
- `base_points` - Maximum points

### hints
- `id` - Hint ID
- `puzzle_id` - Associated puzzle
- `hint_text` - Hint content
- `release_time` - When hint is revealed

### submissions
- `id` - Submission UUID
- `user_id` - User who submitted
- `puzzle_id` - Puzzle attempted
- `answer_hash` - Hash of submitted answer
- `is_correct` - Whether correct
- `score` - Points earned
- `submitted_at` - Timestamp

## Security Notes

- Answer hashes are stored in the database, never the plaintext answers
- The `check_answer` function runs server-side with SECURITY DEFINER
- Row Level Security (RLS) is enabled on all tables
- Users can only see their own submissions
- Answer verification happens on the server, not in JavaScript

## Troubleshooting

### "Login not working"
- Check Google OAuth credentials in Supabase
- Verify redirect URLs are configured
- Ensure Site URL is set correctly

### "Puzzles not loading"
- Check browser console for errors
- Verify Supabase URL and anon key in scripts.js
- Ensure database schema was applied correctly

### "Leaderboard empty"
- The leaderboard only shows users with at least one solved puzzle
- Check if the `leaderboard_view` was created properly
