<template>
  <div v-if="shouldShowPrizePool" class="prize-pool-container">
    <div class="prize-label">PRIZE POOL</div>
    <div class="prize-list">
      <div 
        v-for="group in mergedPrizePool" 
        :key="group.prize" 
        class="prize-item"
      >
        Rank {{ group.ranks }}: {{ group.prize }} {{group.note}}
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
    },
    mergedPrizePool() {
      if (!this.prizePool || !this.prizePool.length) return [];

      // Group prizes by their amount
      const groupedPrizes = {};

      this.prizePool.forEach(prize => {
        const prizeAmount = prize.prize;
        if (!groupedPrizes[prizeAmount]) {
          groupedPrizes[prizeAmount] = {
            prize: prizeAmount,
            ranks: [],
            note: prize.note
          };
        }
        groupedPrizes[prizeAmount].ranks.push(prize.rank);
      });

      // Convert to array and format the ranks display
      return Object.values(groupedPrizes).map(group => {
        if (group.ranks.length === 1) {
          group.ranks = group.ranks[0];
        } else if (group.ranks.length === 2) {
          group.ranks = `${group.ranks[0]} & ${group.ranks[1]}`;
        } else {
          // Find consecutive sequences
          const sequences = [];
          let currentSeq = [group.ranks[0]];

          for (let i = 1; i < group.ranks.length; i++) {
            if (group.ranks[i] === group.ranks[i-1] + 1) {
              currentSeq.push(group.ranks[i]);
            } else {
              sequences.push([...currentSeq]);
              currentSeq = [group.ranks[i]];
            }
          }
          sequences.push(currentSeq);

          // Format each sequence
          const formattedSequences = sequences.map(seq => {
            if (seq.length === 1) return seq[0];
            return `${seq[0]}-${seq[seq.length-1]}`;
          });

          group.ranks = formattedSequences.join(', ');
        }
        return group;
      }).sort((a, b) => {
        // Sort by the first rank in each group
        const aFirstRank = this.prizePool.find(p => p.prize === a.prize)?.rank || 0;
        const bFirstRank = this.prizePool.find(p => p.prize === b.prize)?.rank || 0;
        return aFirstRank - bFirstRank;
      });
    }
  }
}
</script>

<style scoped>
.prize-pool-container {
  margin: 10px 0;
  color: white;
  max-width: 100%;
  overflow: hidden;
}

.prize-label {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 6px;
  color: #ffffff;
  letter-spacing: 0.5px;
}

.prize-list {
  display: flex;
  flex-direction: column;
  gap: 0px;
}

.prize-item {
  font-size: 1.6rem;
  color: #fff;
  font-weight: 600;
  letter-spacing: 0.3px;
}
</style>
