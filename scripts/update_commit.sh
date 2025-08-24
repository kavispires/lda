#!/bin/bash

echo "⏰ Changing the last commit timestamp..."

# Get hashes
latest_commit=$(git rev-parse HEAD)
previous_commit=$(git rev-parse HEAD~1)

# Get timestamps
latest_timestamp=$(git show -s --format=%ci "$latest_commit")
previous_timestamp=$(git show -s --format=%ci "$previous_commit")

echo "🕒 Last commit:     $latest_commit"
echo "📅 Last timestamp:  $latest_timestamp"
echo ""
echo "🕒 Previous commit: $previous_commit"
echo "📅 Prev timestamp:  $previous_timestamp"
echo ""

# Prompt user for input
read -p "📆 Enter new date (YYYY-MM-DD): " input_date
read -p "⏰ Enter new time (HH:MM, 24-hour): " input_time

# Generate random seconds (00–59), zero-padded
random_seconds=$(printf "%02d" $((RANDOM % 60)))

# Combine into full datetime
new_datetime="${input_date} ${input_time}:${random_seconds}"

# Convert to RFC 2822 format (macOS specific)
git_date=$(date -jf "%Y-%m-%d %H:%M:%S" "$new_datetime" "+%a, %d %b %Y %H:%M:%S %z")

# Check if conversion succeeded
if [ -z "$git_date" ]; then
  echo "❌ Invalid date/time. Please use format YYYY-MM-DD and HH:MM"
  exit 1
fi

echo ""
echo "🎲 Random seconds:  $random_seconds"
echo "🔧 Amending commit to: $git_date"
GIT_COMMITTER_DATE="$git_date" git commit --amend --no-edit -n --date="$git_date"

echo "✅ Commit timestamp updated!"
