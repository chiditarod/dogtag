// Race form: keep the zone shown beside each date field in step with the
// time zone select, since the dates are parsed in the selected zone.
$(document).on("change", "#race_time_zone", function () {
  var label = $(this).find("option:selected").data("zone-label");
  if (label) {
    $(".js-time-zone-label").text(label);
  }
});
