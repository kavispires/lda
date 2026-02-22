#!/bin/bash

# Force Timezone to California
export TZ="America/Los_Angeles"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⏰ Changing the last commit timestamp...${NC}"

# --- 1. GET INFO ---

# Get hashes
latest_commit=$(git rev-parse --short HEAD)
previous_commit=$(git rev-parse --short HEAD~1)

# Get timestamps for display (Fixed the %A placement bug)
latest_display=$(git show -s --format='%ad' --date=format:'%Y-%m-%d %H:%M:%S (%A)' "$latest_commit")
previous_display=$(git show -s --format='%ad' --date=format:'%Y-%m-%d %H:%M:%S (%A)' "$previous_commit")

# Get Previous Commit Epoch and Date (for calculation)
prev_epoch=$(git show -s --format='%at' HEAD~1)
prev_date_str=$(git show -s --format='%ad' --date=format:'%Y-%m-%d' HEAD~1)

# Get Today's Date
today_date_str=$(date "+%Y-%m-%d")

echo ""
echo -e "🕒 Last commit:     ${BLUE}$latest_commit${NC}  | $latest_display"
echo -e "🕒 Previous commit: ${BLUE}$previous_commit${NC}  | $previous_display"
echo "---------------------------------------------------"

# --- 2. SELECT DATE (DYNAMIC RANGE) ---

echo -e "${CYAN}📆 Select a Date (California Time):${NC}"

# Calculate days difference between Today and Previous Commit
# We convert YYYY-MM-DD to seconds (midnight) to get an accurate day count
today_sec=$(date -j -f "%Y-%m-%d" "$today_date_str" "+%s")
prev_sec=$(date -j -f "%Y-%m-%d" "$prev_date_str" "+%s")
diff_sec=$((today_sec - prev_sec))
diff_days=$((diff_sec / 86400))

# Logic: Max 7 days back, but stop at previous commit date
limit=$diff_days

# Cap at 6 (which means 7 options: 0 to 6)
if [ "$limit" -gt 6 ]; then
  limit=6
fi

# If previous commit is somehow in the future relative to today, default to just Today
if [ "$limit" -lt 0 ]; then
  limit=0
fi

# Arrays to store options
date_options=()
date_values=()

# Loop from 0 (Today) back to the limit
for ((i=0; i<=limit; i++)); do
  # macOS date math: -v-0d is today, -v-1d is yesterday
  d_display=$(date -v-${i}d "+%Y-%m-%d (%A)")
  d_value=$(date -v-${i}d "+%Y-%m-%d")

  echo "  [$i] $d_display"
  date_values[$i]="$d_value"
done

echo ""
read -p "Enter choice [0-$limit]: " date_idx

# Validate input
if [[ ! "$date_idx" =~ ^[0-9]+$ ]] || [ "$date_idx" -gt "$limit" ]; then
  echo "❌ Invalid selection. Defaulting to Today."
  date_idx=0
fi
selected_date=${date_values[$date_idx]}

# --- 3. SELECT TIME ---

echo ""
echo -e "${CYAN}⏰ Select a Time (Relative to Previous Commit):${NC}"

get_random_time() {
  local min=$1
  local max=$2
  local min_offset=$(( (RANDOM % (max - min + 1)) + min ))
  local sec_offset=$(( RANDOM % 60 ))
  local total_add=$(( (min_offset * 60) + sec_offset ))

  # Calculate time based on Previous Commit Epoch
  date -r $((prev_epoch + total_add)) "+%H:%M:%S"
}

t_opt1=$(get_random_time 9 13)
t_opt2=$(get_random_time 16 21)
t_opt3=$(get_random_time 28 36)

echo "  [1] $t_opt1"
echo "  [2] $t_opt2"
echo "  [3] $t_opt3"
echo "  [4] Custom Time"

echo ""
read -p "Enter choice [1-4]: " time_idx

if [ "$time_idx" == "1" ]; then
  selected_time="$t_opt1"
elif [ "$time_idx" == "2" ]; then
  selected_time="$t_opt2"
elif [ "$time_idx" == "3" ]; then
  selected_time="$t_opt3"
else
  read -p "⌨️  Enter time (HH:MM:SS): " manual_time
  if [[ "$manual_time" =~ ^[0-9]{2}:[0-9]{2}$ ]]; then
     manual_time="${manual_time}:$(printf "%02d" $((RANDOM % 60)))"
  fi
  selected_time="$manual_time"
fi

# --- 4. EXECUTE ---

full_datetime_str="$selected_date $selected_time"

# Convert to Git format
git_date=$(date -jf "%Y-%m-%d %H:%M:%S" "$full_datetime_str" "+%a, %d %b %Y %H:%M:%S %z" 2>/dev/null)

if [ -z "$git_date" ]; then
  echo "❌ Invalid date format generated: $full_datetime_str"
  exit 1
fi

echo ""
echo -e "🔧 Amending to: ${GREEN}$git_date${NC}"

GIT_COMMITTER_DATE="$git_date" git commit --amend --no-edit -n --date="$git_date" > /dev/null

echo -e "✅ ${GREEN}Success!${NC}"
