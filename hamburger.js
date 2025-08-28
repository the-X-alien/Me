document.body.insertAdjacentHTML('afterbegin', `
  <header>
    <div class="hamburger" onclick="toggleMenu()">
      <div></div>
      <div></div>
      <div></div>
    </div>
    <h1>My Site</h1>
    <div class="dropdown" id="dropdownMenu">
      <a href="index.html">Home</a>
      <a href="blog.html">Home</a>
      <a href="contact.html">Home</a>
      <a href="spotify.html">Spotify</a>
      <a href="youtube.html">YouTube</a>
      <a href="duolingo.html">Duolingo</a>
      <a href="monkeytype.html">Monkeytype</a>
    </div>
  </header>
`);

function toggleMenu() {
  const menu = document.getElementById('dropdownMenu');
  menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
}
