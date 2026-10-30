// SAMPLE NUMBERS ONLY. Made up, so the layout can be seen before any source
// is connected. index.html shows a banner whenever these are on screen.
(function () {
  var seed = 7;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  function pickWeighted(items) {
    var total = items.reduce(function (s, it) {
      return s + it[1];
    }, 0);
    var r = rand() * total;
    for (var i = 0; i < items.length; i++) {
      r -= items[i][1];
      if (r <= 0) return items[i][0];
    }
    return items[items.length - 1][0];
  }
  function iso(d) {
    return d.toISOString().slice(0, 10);
  }
  function days(from, to) {
    var out = [];
    for (
      var d = new Date(from + "T12:00:00Z");
      iso(d) <= to;
      d.setUTCDate(d.getUTCDate() + 1)
    )
      out.push(iso(d));
    return out;
  }

  var today = "2026-10-21";
  var orders = [],
    visits = [],
    waitlist = [],
    requests = [];

  days("2026-09-14", today).forEach(function (date, i) {
    var visitors = Math.round(60 + i * 3.2 + rand() * 40);
    var sessions = Math.round(visitors * (0.03 + rand() * 0.03));
    visits.push({
      date: date,
      visitors: visitors,
      registerClicks: Math.round(sessions * 1.2),
    });
    for (var s = 0; s < sessions; s++) {
      var workshop = date >= "2026-10-08" && rand() < 0.55 ? "miami" : "austin";
      var students = rand() < 0.3 ? 2 : 1;
      var paid = rand() < 0.55;
      orders.push({
        date: date,
        workshop: workshop,
        students: students,
        status: paid ? "paid" : "abandoned",
        amount: paid ? (students === 2 ? 500 : 300) : 0,
        refunded: paid && rand() < 0.04 ? (students === 2 ? 500 : 300) : 0,
      });
    }
    var signups = Math.round(rand() * 4 + i * 0.05);
    for (var w = 0; w < signups; w++) {
      waitlist.push({
        date: date,
        city: pickWeighted([
          ["Austin", 5],
          ["Miami", 4],
          ["Houston", 2],
          ["Dallas", 2],
          ["Orlando", 1],
          ["Atlanta", 1],
        ]),
        heardFrom: pickWeighted([
          ["Friend or family", 9],
          ["Social media", 7],
          ["School or teacher", 5],
          ["WhatsApp group", 4],
          ["Google search", 3],
          ["A past YXO workshop", 2],
          ["OpenExO / Singularity community", 2],
          ["Other", 1],
        ]),
      });
    }
    if (rand() < 0.22) {
      requests.push({
        date: date,
        city: pickWeighted([
          ["Houston", 3],
          ["Dallas", 2],
          ["Atlanta", 2],
          ["Tampa", 1],
        ]),
        students: Math.round(8 + rand() * 20),
      });
    }
  });

  // Keep each workshop at or under its 50 seats.
  ["austin", "miami"].forEach(function (key) {
    var seats = 0;
    orders.forEach(function (o) {
      if (o.workshop !== key || o.status !== "paid") return;
      if (seats + o.students > (key === "austin" ? 46 : 31)) {
        o.status = "abandoned";
        o.amount = 0;
        o.refunded = 0;
      } else seats += o.students;
    });
  });

  window.YXO_SAMPLE = {
    generatedAt: today + "T12:00:00Z",
    today: today,
    sample: true,
    config: {
      workshops: [
        { key: "austin", name: "Austin", date: "2026-10-24", capacity: 50 },
        { key: "miami", name: "Miami", date: "2026-11-07", capacity: 50 },
      ],
      notes: [
        "Analytics starts with the Miami run-up, so Austin has no visitor numbers.",
      ],
      reminders: ["Test PostHog against Plausible"],
    },
    sources: {
      stripe: { status: "sample", note: "Sample numbers" },
      plausible: { status: "sample", note: "Sample numbers" },
      waitlist: { status: "sample", note: "Sample numbers", withProp: true },
      requests: { status: "sample", note: "Sample numbers", withProp: true },
    },
    orders: orders,
    visits: visits,
    waitlist: waitlist,
    requests: requests,
  };
})();
