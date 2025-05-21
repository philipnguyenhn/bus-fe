import { createRouter, createWebHistory } from 'vue-router';
import TournamentView from '../views/TournamentView.vue';

const routes = [
  {
    path: '/',
    redirect: '/tournament/2' // Default to tournament ID 2
  },
  {
    path: '/tournament/:id',
    name: 'Tournament',
    component: TournamentView,
    props: true
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
