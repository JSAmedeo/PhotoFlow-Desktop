// Mock data: hours, sessions, photos for the active session.

const HOURS = [
  { h:"08:00", label:"8 – 9 AM",   sub:"Open",       count:14, flagged:0 },
  { h:"09:00", label:"9 – 10 AM",  sub:"Morning",    count:32, flagged:2 },
  { h:"10:00", label:"10 – 11 AM", sub:"Morning",    count:48, flagged:1 },
  { h:"11:00", label:"11 – 12 PM", sub:"Late AM",    count:54, flagged:3 },
  { h:"12:00", label:"12 – 1 PM",  sub:"Midday",     count:61, flagged:4 },
  { h:"13:00", label:"1 – 2 PM",   sub:"Lunch peak", count:72, flagged:5 },
  { h:"14:00", label:"2 – 3 PM",   sub:"Afternoon",  count:58, flagged:2, selected:true },
  { h:"15:00", label:"3 – 4 PM",   sub:"Afternoon",  count:46, flagged:1 },
  { h:"16:00", label:"4 – 5 PM",   sub:"Late PM",    count:41, flagged:2 },
  { h:"17:00", label:"5 – 6 PM",   sub:"Wind down",  count:28, flagged:0 },
  { h:"18:00", label:"6 – 7 PM",   sub:"Evening",    count:12, flagged:0 },
  { h:"19:00", label:"7 – 8 PM",   sub:"Close",       count:5, flagged:0 },
];

const TINTS = [
  ['#3a5f78','#1f3a4a'], ['#5a4878','#2f2a4a'], ['#4a7858','#1f4a30'],
  ['#785a48','#4a2f1f'], ['#4f5878','#2a304a'], ['#785063','#4a2a36'],
  ['#3a7868','#1f4a3f'], ['#787858','#4a4a2a'], ['#583a78','#2f1f4a'],
  ['#487868','#1f4a3f'], ['#78483a','#4a201f'], ['#3a4878','#1f2a4a'],
];

const SESSIONS = [
  { code:"XYZ0001411", time:"2:02:17 PM",  count:4, flagged:false, photos:["a","b","c","d"], tint:TINTS[0]},
  { code:"XYZ0001412", time:"2:05:33 PM",  count:3, flagged:false, photos:["a","b","c"], tint:TINTS[1]},
  { code:"XYZ0001413", time:"2:08:46 PM",  count:5, flagged:true,  photos:["a","b","c","d","e"], tint:TINTS[2]},
  { code:"XYZ0001414", time:"2:11:09 PM",  count:2, flagged:false, photos:["a","b"], tint:TINTS[3]},
  { code:"XYZ0001415", time:"2:14:51 PM",  count:4, flagged:false, photos:["a","b","c","d"], tint:TINTS[4], active:true},
  { code:"XYZ0001416", time:"2:18:02 PM",  count:3, flagged:false, photos:["a","b","c"], tint:TINTS[5]},
  { code:"XYZ0001417", time:"2:21:27 PM",  count:4, flagged:false, photos:["a","b","c","d"], tint:TINTS[6]},
  { code:"XYZ0001418", time:"2:24:18 PM",  count:5, flagged:true,  photos:["a","b","c","d","e"], tint:TINTS[7]},
  { code:"XYZ0001419", time:"2:27:55 PM",  count:3, flagged:false, photos:["a","b","c"], tint:TINTS[8]},
  { code:"XYZ0001420", time:"2:31:02 PM",  count:4, flagged:false, photos:["a","b","c","d"], tint:TINTS[9]},
  { code:"XYZ0001421", time:"2:34:39 PM",  count:2, flagged:false, photos:["a","b"], tint:TINTS[10]},
  { code:"XYZ0001422", time:"2:38:12 PM",  count:4, flagged:false, photos:["a","b","c","d"], tint:TINTS[11]},
  { code:"XYZ0001423", time:"2:41:47 PM",  count:3, flagged:false, photos:["a","b","c"], tint:TINTS[0]},
  { code:"XYZ0001424", time:"2:45:23 PM",  count:5, flagged:true,  photos:["a","b","c","d","e"], tint:TINTS[1]},
];

const ACTIVE_PHOTOS = [
  { idx:1, frame:"XYZ0001501", w:6000, h:4000, status:"done",       enhance:"v2.4" },
  { idx:2, frame:"XYZ0001502", w:6000, h:4000, status:"done",       enhance:"v2.4" },
  { idx:3, frame:"XYZ0001503", w:6000, h:4000, status:"processing", enhance:"v2.4" },
  { idx:4, frame:"XYZ0001504", w:6000, h:4000, status:"warn",       enhance:"v2.4" },
];

// Hour label → standard-time short form (used in headers like "2 PM Sessions")
const HOUR_SHORT = {
  "08:00":"8 AM", "09:00":"9 AM", "10:00":"10 AM", "11:00":"11 AM",
  "12:00":"12 PM","13:00":"1 PM", "14:00":"2 PM", "15:00":"3 PM",
  "16:00":"4 PM", "17:00":"5 PM", "18:00":"6 PM", "19:00":"7 PM",
};

window.HOURS = HOURS;
window.SESSIONS = SESSIONS;
window.TINTS = TINTS;
window.ACTIVE_PHOTOS = ACTIVE_PHOTOS;
window.HOUR_SHORT = HOUR_SHORT;
