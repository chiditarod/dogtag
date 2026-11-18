// Bootstrap tooltips for `.js-tooltip` icons. They show on hover and keyboard
// focus; a tap or click focuses the icon, which shows the tip on touch screens
// and keeps the click from closing an open dropdown menu.
// (bootstrap.min.js loads after this file, so wait for the DOM to be ready.)
$(function () {
  $(".js-tooltip")
    .tooltip()
    .on("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      this.focus();
    });
});
