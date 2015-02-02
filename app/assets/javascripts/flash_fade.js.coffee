# this fades the rails flash in and out.

$(document).ready ->
  $(".alert").delay(2500).fadeTo(1000, 0)
