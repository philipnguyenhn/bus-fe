<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getTournamentById } from '../services/tournamentService';
import TournamentPrizePool from "@/components/TournamentPrizePool.vue";

const tournament = ref(null);
const loading = ref(true);
const error = ref(null);
const route = useRoute();
const router = useRouter();
const timer = ref('');
let clockInterval = null;
let pollingInterval = null;

const currentActiveTimerSeconds = ref(0);
const activeTimerType = ref(null);
const nextBreakInTimerDisplay = ref('--:--');
const nextBreakInSeconds = ref(0);

const formattedCurrentHhMmTime = computed(() => {
  if (tournament.value && typeof tournament.value.current_time === 'string') {
    const parts = tournament.value.current_time.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return tournament.value.current_time; 
  }
  return 'N/A'; 
});

const formattedBlinds = computed(() => {
  if (!tournament.value || !tournament.value.blinds || 
      typeof tournament.value.blinds.small_blind === 'undefined' || 
      typeof tournament.value.blinds.big_blind === 'undefined' || 
      typeof tournament.value.blinds.ante === 'undefined') {
    return 'N/A';
  }
  return `${tournament.value.blinds.small_blind}/${tournament.value.blinds.big_blind}/${tournament.value.blinds.ante}`;
});

const formattedNextBlinds = computed(() => {
  if (!tournament.value || !tournament.value.next_blinds || 
      typeof tournament.value.next_blinds.small_blind === 'undefined' || 
      typeof tournament.value.next_blinds.big_blind === 'undefined' || 
      typeof tournament.value.next_blinds.ante === 'undefined') {
    return 'N/A';
  }
  return `${tournament.value.next_blinds.small_blind}/${tournament.value.next_blinds.big_blind}/${tournament.value.next_blinds.ante}`;
});

const parseTimeToSeconds = (timeString) => {
  const parts = timeString.split(':').map(Number);

  // Handle HH:MM:SS format
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return (hours * 60 * 60) + (minutes * 60) + seconds;
  }

  // Handle MM:SS format
  const [minutes, seconds] = parts;
  return minutes * 60 + seconds;
};

const formatSecondsToTime = (totalSeconds, includeHours = false) => {
  if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
    return includeHours ? '--:--:--' : '--:--'; 
  }
  
  if (includeHours) {
    // HH:MM:SS format
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    // MM:SS format
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
};

const breakTimer = ref('');

const startClock = () => {
  if (!tournament.value) return;

  const {
    clock_stopped,
    on_break,
    timer: apiTimerString,
    break_time_remaining: apiBreakTimerString,
    next_break_in: apiNextBreakInString
  } = tournament.value;

  // Process next_break_in timer if available
  if (typeof apiNextBreakInString === 'string' && apiNextBreakInString.includes(':')) {
    try {
      // Parse the time string to seconds
      nextBreakInSeconds.value = parseTimeToSeconds(apiNextBreakInString);
      
      // Format in HH:MM:SS for next_break_in
      nextBreakInTimerDisplay.value = formatSecondsToTime(nextBreakInSeconds.value, true);
    } catch {
      console.error('Failed to parse next_break_in:', apiNextBreakInString);
      nextBreakInTimerDisplay.value = '--:--:--';
    }
  } else {
    nextBreakInTimerDisplay.value = '--:--:--';
  }

  if (clock_stopped) {
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = null;
    activeTimerType.value = null; 
    currentActiveTimerSeconds.value = 0; 

    if (on_break) {
      timer.value = '--:--';
      try {
        breakTimer.value = formatSecondsToTime(parseTimeToSeconds(apiBreakTimerString || "0:0"), false);
      } catch { breakTimer.value = formatSecondsToTime(0, false); }
    } else { 
      breakTimer.value = '--:--';
      try {
        timer.value = formatSecondsToTime(parseTimeToSeconds(apiTimerString || "0:0"), false);
      } catch { timer.value = formatSecondsToTime(0, false); }
    }
    return; 
  }

  let newTimeSourceInSeconds = null;
  let newActiveType = null; 

  if (on_break) {
    if (typeof apiBreakTimerString === 'string' && apiBreakTimerString.includes(':')) {
      try { 
        newTimeSourceInSeconds = parseTimeToSeconds(apiBreakTimerString);
        newActiveType = 'break';
      } catch { console.error('Failed to parse break_time_remaining:', apiBreakTimerString); }
    }
  } else { 
    if (typeof apiTimerString === 'string' && apiTimerString.includes(':')) {
      try { 
        newTimeSourceInSeconds = parseTimeToSeconds(apiTimerString);
        newActiveType = 'main';
      } catch { console.error('Failed to parse timer string:', apiTimerString); }
    }
  }

  if (newTimeSourceInSeconds === null) {
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = null;
    activeTimerType.value = null;
    currentActiveTimerSeconds.value = 0;
    timer.value = '--:--';
    breakTimer.value = '--:--';
    console.warn(`Clock is running but no valid timer string for mode: ${on_break ? 'break' : 'main'}`);
    return;
  }

  if (
    !clockInterval || 
    activeTimerType.value !== newActiveType || 
    Math.abs(currentActiveTimerSeconds.value - newTimeSourceInSeconds) > 2 
  ) {
    if (clockInterval) clearInterval(clockInterval);

    currentActiveTimerSeconds.value = newTimeSourceInSeconds;
    activeTimerType.value = newActiveType;

    if (newActiveType === 'break') {
      breakTimer.value = formatSecondsToTime(currentActiveTimerSeconds.value);
      timer.value = '--:--'; 
    } else { 
      timer.value = formatSecondsToTime(currentActiveTimerSeconds.value);
      breakTimer.value = '--:--'; 
    }
    
    clockInterval = setInterval(() => {
      let mainTimerOrBreakTimerHitZero = false;

      if (activeTimerType.value === 'main' && currentActiveTimerSeconds.value > 0) {
        currentActiveTimerSeconds.value--;
        timer.value = formatSecondsToTime(currentActiveTimerSeconds.value, false);
        if (nextBreakInSeconds.value > 0 && !on_break && !clock_stopped) {
          nextBreakInSeconds.value--;
          nextBreakInTimerDisplay.value = formatSecondsToTime(nextBreakInSeconds.value, true);
        }
        if (currentActiveTimerSeconds.value === 0) mainTimerOrBreakTimerHitZero = true;
      } else if (activeTimerType.value === 'break' && currentActiveTimerSeconds.value > 0) {
        currentActiveTimerSeconds.value--;
        breakTimer.value = formatSecondsToTime(currentActiveTimerSeconds.value, false);
        if (currentActiveTimerSeconds.value === 0) mainTimerOrBreakTimerHitZero = true;
      } else {
        mainTimerOrBreakTimerHitZero = true;
      }

      if (mainTimerOrBreakTimerHitZero) {
        console.log(`${activeTimerType.value} timer hit 0. Waiting for server update.`);
      }
    }, 1000);
  } else {
    timer.value = formatSecondsToTime(currentActiveTimerSeconds.value);
    if (activeTimerType.value === 'break') {
      breakTimer.value = formatSecondsToTime(currentActiveTimerSeconds.value);
    }
  }
};



// Initial data fetch - shows loading state
const fetchInitialTournamentData = async () => {
  loading.value = true;
  error.value = null;
  
  // Default to tournament ID 6 if none is provided in the route
  const tournamentId = route.params.id || '6';
  
  try {
    tournament.value = await getTournamentById(tournamentId);
  } catch (err) {
    console.error('Failed to fetch initial tournament data:', err);
    error.value = 'Failed to load tournament data. Please check connection or try again.';
  } finally {
    loading.value = false;
    startClock();
  }
};

// Background update - doesn't show loading state or disrupt UI
const updateTournamentData = async () => {
  if (loading.value) return; // Don't overlap with initial load
  
  const tournamentId = route.params.id || '6';
  
  try {
    const newData = await getTournamentById(tournamentId);
    
    // Only update if we got valid data
    if (newData) {
      // Update tournament data without disrupting UI
      tournament.value = newData;
      error.value = null;
      startClock();
    }
  } catch (err) {
    console.error('Background tournament update failed:', err);
    // Don't show error to user for background updates
    // This prevents UI disruption for temporary network issues
  }
};

onMounted(() => {
  // Initial data load with loading indicator
  fetchInitialTournamentData();
  
  // Set up background polling every 5 seconds
  pollingInterval = setInterval(() => {
    updateTournamentData();
  }, 5000);
});

onUnmounted(() => {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('Tournament polling stopped on component unmount.');
  }
});
</script>

<template>
  <div class="tournament-view">
    <div v-if="loading" class="loading">Loading tournament data...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="tournament" class="tournament-dashboard">
      <!-- Header with time, tournament name and date -->
      <div class="header">
        <div class="current-time">{{ formattedCurrentHhMmTime }}</div>
        <div class="tournament-name">
          <div class="tournament-title">{{ tournament ? tournament.name || 'WORKSHOP MADNESS' : 'WORKSHOP MADNESS' }}</div>
        </div>
        <div class="tournament-date">{{ tournament.date }}</div>
      </div>
      
      <!-- Tournament info bar -->
      <div class="tournament-info">
        <div>
          STARTING CHIPS <span class="info-value">{{ typeof tournament.starting_chips === 'number' ? tournament.starting_chips.toLocaleString() : tournament.starting_chips }}</span> - 
          REG CLOSE START OF LV <span class="info-value">{{ tournament.reg_close_level }}</span> 
          (<span class="info-value">{{ tournament.reg_close_time }}</span>) - 
          GTD: <span class="info-value">{{ tournament.gtd }}</span>
        </div>
      </div>
      
      <!-- Main content area with stats and timer -->
      <div class="main-content">
        <!-- Left stats column -->
        <div class="left-column">
          <!-- Players/Entries -->
          <div class="stat-group">
            <div class="stat-label">PLAYERS / ENTRIES</div>
            <div class="stat-value players-entries">{{ tournament.player_entries }}</div>
          </div>
          
          <!-- Re-entries -->
          <div class="stat-group">
            <div class="stat-label">RE-ENTRIES</div>
            <div class="stat-value re-entries">{{ tournament.re_entries }}</div>
          </div>
          
          <!-- Total chips -->
          <div class="stat-group">
            <div class="stat-label">TOTAL CHIPS</div>
            <div class="stat-value total-chips">{{ typeof tournament.total_chips === 'number' ? tournament.total_chips.toLocaleString() : 0 }}</div>
          </div>
          
          <!-- Average stack -->
          <div class="stat-group">
            <div class="stat-label">AVG STACK</div>
            <div class="stat-value avg-stack">{{ typeof tournament.avg_stack === 'number' ? tournament.avg_stack.toLocaleString() : 0 }}</div>
          </div>
          
          <!-- Next break -->
          <div class="stat-group">
            <div class="stat-label">NEXT BREAK IN</div>
            <div class="stat-value next-break">{{ nextBreakInTimerDisplay }}</div>
          </div>
        </div>
        
        <!-- Center area with level, timer and blinds -->
        <div class="center-area">
          <!-- Level indicator -->
          <div class="level-container">
            <div class="level-display">LEVEL {{ tournament.current_level }}</div>
          </div>
          
          <!-- Timer -->
          <div class="timer-container">
            <div v-if="tournament.clock_stopped" class="clock-stopped">
              Clock Stopped
            </div>
            <div v-else-if="tournament.on_break" class="break-timer">
              <div class="break-label">BREAK TIME</div>
              <div class="break-time">{{ breakTimer }}</div>
            </div>
            <div v-else class="timer">
              {{ timer }}
            </div>
          </div>
          
          <!-- Blinds info -->
          <div class="blinds-container">
            <div class="blind-row">
              <div class="blind-label">Blind:</div>
              <div class="blind-value">{{ formattedBlinds }}</div>
            </div>
            
            <div class="next-blinds">
              <div class="next-blinds-row">
                <div class="next-blinds-label">Next Blinds</div>
                <div class="next-blinds-value">{{ formattedNextBlinds }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Right prize pool column -->
                <div class="right-column">
                  <!-- Prize pool -->
                  <TournamentPrizePool 
                    :prizePool="tournament.prize_pool" 
                    :currentLevel="tournament.current_level" 
                    :regCloseLevel="tournament.reg_close_level"
                    :forceShow="false" 
                  />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Import Reddit Sans font */
@font-face {
  font-family: 'Reddit Sans';
  src: url('https://www.redditstatic.com/desktop2x/fonts/Reddit-Sans-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: 'Reddit Sans';
  src: url('https://www.redditstatic.com/desktop2x/fonts/Reddit-Sans-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
}

@font-face {
  font-family: 'Reddit Sans';
  src: url('https://www.redditstatic.com/desktop2x/fonts/Reddit-Sans-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
}

@font-face {
  font-family: 'Reddit Sans';
  src: url('https://www.redditstatic.com/desktop2x/fonts/Reddit-Sans-ExtraBold.woff2') format('woff2');
  font-weight: 800;
  font-style: normal;
}
.tournament-view {
  width: 100vw;
  height: 100vh;
  background-image: url('/images/11.jpg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  color: white;
  font-family: 'Reddit Sans', sans-serif;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.loading, .error {
  margin-top: 2rem;
  font-size: 1.8125rem;
  text-align: center;
}

.tournament-dashboard {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Header styles */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 2rem;
  height: 10vh;
  width: 100%;
  box-sizing: border-box;
}

.current-time {
  font-size: 2.8125rem;
  font-weight: bold;
}

.tournament-name {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-weight: bold;
  text-transform: uppercase;
  line-height: 1;
}

.name-top, .name-bottom {
  font-size: 2.8125rem;
}

.tournament-date {
  font-size: 2.8125rem;
  font-weight: bold;
}

.tournament-info {
  width: 100%;
  text-align: center;
  padding: 0.5rem;
  font-size: 1.5125rem;
  background-color: rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
}

.info-value {
  font-weight: 800;
  color: white;
}

.main-content {
  display: flex;
  flex: 1;
  height: 85vh;
  width: 100%;
  box-sizing: border-box;
  position: relative;
}

/* Left column with stats */
.left-column {
  width: 30%;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  box-sizing: border-box;
}

.stat-group {
  margin-bottom: 10px;
}

.stat-label {
  font-size: 1.5125rem;
  font-weight: bold;
  margin-bottom: 0.2rem;
}

.stat-value {
  font-size: 2.8125rem;
  font-weight: bold;
}

/* Center area with level, timer and blinds */
.center-area {
  width: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 2rem;
}

.center-area .level-container, 
.center-area .timer-container .timer, 
.center-area .break-timer, 
.center-area .blinds-container .blind-label, 
.center-area .next-blinds {
  text-align: center;
}

/* Right column for prize pool */
.right-column {
  width: 30%; 
  padding: 2rem; 
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-start; 
}

.prize-pool-container .prize-label,
.prize-pool-container .prize-value {
   text-align: left; 
}

/* Level styles */
.level-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1rem;
}

.level-label {
  font-size: 2.1125rem;
  font-weight: bold;
  color: yellow;
  text-align: center;
}

.level-display {
  font-size: 3.5rem; /* 2x smaller than 6rem */
  font-weight: bold;
  line-height: 1;
  text-align: center;
}

/* Timer styles */
.timer-container {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
  margin-top: 1rem;
}

.timer {
  font-size: 19.25rem; /* 2x bigger than 24.625rem */
  font-weight: bold;
  line-height: 1;
}

.clock-stopped {
  font-size: 5.3125rem;
  color: white;
  font-weight: bold;
  background-color: red;
  padding: 1rem 6rem;
  border-radius: 0.5rem;
  text-align: center;
  text-transform: uppercase;
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
}

/* Break timer styling */
.break-timer {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.break-label {
  font-size: 4.3125rem;
  color: yellow;
  font-weight: bold;
  text-transform: uppercase;
  margin-bottom: 1rem;
}

.break-time {
  font-size: 8.3125rem;
  color: white;
  font-weight: bold;
}

/* Blinds styles */
.blinds-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.blind-row {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 0.5rem;
}

.blind-label {
  font-size: 3.22rem; /* 1.5x bigger than 2.8125rem */
  width: 25%;
  text-align: right;
  padding-right: 1rem;
}

.blind-value {
  font-size: 5.47rem; /* 1.5x bigger than 4.3125rem */
  font-weight: bold;
  color: yellow;
  width: 75%;
  text-align: left;
}

.next-blinds {
  margin-top: 1rem;
  text-align: center;
}

.next-blinds-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
}

.next-blinds-label {
  font-size: 2.27rem; /* 1.5x bigger than 1.5125rem */
}

.next-blinds-value {
  font-size: 2.27rem;
  color: yellow;
  font-weight: bold;
}

/* Prize pool container styling */
.prize-pool-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.prize-label {
  font-size: 1.8125rem;
  font-weight: bold;
  margin-bottom: 0.3rem;
  text-align: center;
}

.prize-value {
  font-size: 4.3125rem;
  font-weight: bold;
  color: white;
  text-align: center;
}

/* Responsive adjustments */
@media (max-height: 800px) {
  .current-time, .tournament-date {
    font-size: 2.3125rem;
  }
  
  .tournament-title {
    font-size: 5.47rem;
  }
  
  .timer {
    font-size: 13.3125rem;
  }
  
  .blind-value {
    font-size: 3.3125rem;
  }
  
  .stat-label {
    font-size: 1.3125rem;
  }
  
  .stat-value {
    font-size: 2.3125rem;
  }
}

/* Highlight colors for key stats */
.players-entries, .re-entries, .total-chips, .avg-stack, .prize-pool, .next-break {
  font-weight: bold;
}
</style>
