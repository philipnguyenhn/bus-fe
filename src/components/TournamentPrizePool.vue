<template>
  <div v-if="shouldShowPrizePool" class="prize-pool-container">
    <div class="prize-label">PRIZE POOL</div>
    <div class="prize-list">
      <div 
        v-for="prize in prizePool" 
        :key="prize.position" 
        class="prize-item"
      >
        Rank {{ prize.rank }}: {{ prize.prize }} {{prize.note}}
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TournamentPrizePool',
  props: {
    prizePool: {
      type: Array,
      required: true
    },
    currentLevel: {
      type: Number,
      default: 0
    },
    regCloseLevel: {
      type: Number,
      default: 0
    },
    // Override for development/testing
    forceShow: {
      type: Boolean,
      default: true // Always show for now
    }
  },
  computed: {
    shouldShowPrizePool() {
      // Always show for now as requested
      // Later will implement: currentLevel > regCloseLevel
      return this.forceShow || (this.prizePool && this.currentLevel >= this.regCloseLevel);
    }
  }
}
</script>

<style scoped>
.prize-pool-container {
  margin: 15px 0;
  color: white;
}

.prize-label {
  font-size: 1.8rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: #ffffff;
  letter-spacing: 0.5px;
}

.prize-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.prize-item {
  font-size: 1.8rem;
  color: #fff;
  font-weight: 600;
  letter-spacing: 0.3px;
}
</style>
