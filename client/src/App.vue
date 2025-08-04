<template>
  <div id="app">
    <VideoPlayer />
  </div>
</template>

<script>
import { defineComponent } from 'vue';
import VideoPlayer from './components/VideoPlayer.vue';

export default defineComponent({
  name: 'App',
  inheritAttrs: false,
  components: {
    VideoPlayer
  }
});
</script>

<style>
:root {
  --background-dark: #000000;
  --background-darker: #1a1a1a;
  --background-darkest: #333333;
  --text-primary: #ffffff;
  --text-secondary: #cccccc;
  --accent-color: #ff0050;
  --accent-hover: #ff3366;
  --star-filled: #ffd700;
  --star-empty: #cccccc;
}

#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: var(--text-primary);
  background-color: var(--background-dark);
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background-color: var(--background-dark);
  color: var(--text-primary);
  font-family: inherit;
}
</style>
