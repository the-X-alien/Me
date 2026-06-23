(function(){
  var audio = document.getElementById('bgMusic');
  if (!audio) return;
  audio.volume = 0.04;
  if (localStorage.getItem('sound') === 'on') {
    audio.play().catch(function(){});
  }
})();
