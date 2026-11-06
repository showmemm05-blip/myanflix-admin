/**
 * Advertisements copy for the step-by-step “New ad” / “Edit ad” wizard (the
 * `Wiz*`, `Corner*`, `EditMode` and `PhoneStep` boards, SPEC §2), including
 * the sentence for each components/ads/adForm.ts `AdIssueCode` (2026-11-04,
 * docs/ads-admin-ux-2026-11-04). Owned by Stage W of BUILD-BRIEF.md; read as
 * `t.adsUi.wizard.*`. English first, then the Burmese typed against it, so a
 * key missing in Burmese is a compile error. Words more than one part uses
 * live in shared.ts.
 *
 * Strings with `{name}` slots are templates, not fragments: the wizard puts
 * a box, a link or a bold value into the slot (components/ads/wizard/fill.tsx)
 * so each language keeps its own word order — the Burmese puts the slot
 * where a Burmese sentence wants it.
 *
 * The Burmese follows the `Words` board and SPEC §6: ကြော်ငြာ အမည် (ad
 * name), ဝန်ထမ်းသာ မြင်ရသော မှတ်စု (private note), ကြားဖြတ်ကြော်ငြာ (ad break)
 * everywhere, နောက်ထပ် ရွေးချယ်စရာများ (more options), ယခုပဲ ဖွင့်မလား (turn it
 * on now?), Latin digits, and never ပြသမှု.
 */

/** "a" or "an" before a spoken number — the numbers a video's length can be that start with a vowel sound. */
const aOr = (n: number) => ([8, 11, 18].includes(n) ? "an" : "a");

export const wizardEn = {
  /** The dialog's title and, when editing, the line under it. */
  titles: {
    newAd: "New ad",
    newCorner: "New corner picture",
    edit: (name: string) => `Edit “${name}”`,
    typeFixed: (type: string) => `${type} · the type can’t be changed`,
  },
  /** The step bar (create) and the parts bar (edit). */
  steps: {
    listLabel: "Steps",
    partsLabel: "Parts of this ad",
    names: {
      type: "Type",
      video: "Video",
      picture: "Picture",
      where: "Where",
      look: "Timing",
      movies: "Movies",
      when: "When",
      check: "Check",
      summary: "Summary",
    },
    numbered: (n: number, name: string) => `${n} ${name}`,
    /** Read after a finished step's name (the ✓ itself is hidden from screen readers). */
    done: "done",
    hasProblem: "has a problem",
    /** The phone's header line and its progress bar. */
    stepOf: (n: number, total: number, name: string) => `Step ${n} of ${total} · ${name}`,
    progress: (n: number, total: number) => `Step ${n} of ${total}`,
  },
  /** One heading per step. */
  headings: {
    type: "What kind of ad is it?",
    mediaVideo: "Add your video and a name",
    mediaCorner: "Add your picture, a name and a link",
    where: "Where should it play?",
    look: "How should the picture appear?",
    movies: "Which movies should it show in?",
    when: "When should it show?",
    check: "Check and save",
    summary: "Summary",
  },
  footer: {
    saveAd: "Save ad",
    saveChanges: "Save changes",
    stopUpload: "Stop upload",
    saving: "Saving…",
    uploadingVideo: (percent: number) => `Uploading video… ${percent}%`,
    checkingVideo: "Checking the video…",
    uploadingPicture: "Uploading picture…",
  },
  /** The red box over a step that holds a problem (`WizProblem`). */
  problems: {
    beforeNext: "Please fix this before going on:",
    beforeSave: "Please fix this before saving:",
  },
  closeConfirm: {
    title: "Close without saving?",
    description: "What you changed in this ad will be lost.",
    /** After a Save created the row and its video, picture or last changes were refused: the ad itself stays. */
    savedTitle: "Close now?",
    savedDescription:
      "The ad is already saved in the list, turned off. Only the changes made after that, and any video or picture still waiting to upload, will be lost.",
    /** Editing, under `savedTitle`: a Save put the new file on the ad, and what followed it was refused. */
    videoKept: "The new video is already on this ad and stays there. Only your other changes will be lost.",
    pictureKept: "The new picture is already on this ad and stays there. Only your other changes will be lost.",
    confirm: "Close without saving",
    keepEditing: "Keep editing",
  },
  toasts: {
    created: "Ad created",
    updated: "Changes saved",
    stopped: "Upload stopped",
    videoRefused: "The ad was saved, but its video was refused",
    pictureRefused: "The ad was saved, but its picture was refused",
    /** Editing: the new file went up, then the rest was refused. */
    videoKept: "The new video is on the ad, but your other changes were not saved",
    pictureKept: "The new picture is on the ad, but your other changes were not saved",
    saveFailed: "Could not save the ad",
  },
  type: {
    groupLabel: "Kind of ad",
    descriptions: {
      VIDEO: "A short video that plays before the movie or during ad breaks.",
      CORNER:
        "A small picture in the corner of the screen while the movie plays. Viewers can tap it to open your web page.",
    },
    /** The word inside the little player drawn on the corner card. */
    theMovie: "the movie",
    fixedNote: "You can’t change the type after saving.",
    fixedNow: "This ad is already saved, so its type can’t change now.",
  },
  media: {
    nameLabel: "Ad name",
    nameHints: {
      VIDEO: "Viewers see this name above the ad while it plays.",
      CORNER: "Only you see this name. Viewers see just the picture.",
    },
    noteLabel: "Private note",
    notePlaceholders: {
      VIDEO: "e.g. Paid until 30 Nov — contact Ko Aung",
      CORNER: "e.g. Sponsor pays per week",
    },
    noteHint: "Only staff see this. Viewers never do.",
    linkLabel: "Web page to open when tapped",
    linkPlaceholder: "https://www.example.com/offer",
    linkHint:
      "When viewers tap the picture, this page opens. It must start with https:// or http://. Leave it empty if tapping should do nothing.",
  },
  /** components/ads/AdVideoField.tsx */
  video: {
    label: "Video",
    empty: "No video yet",
    choose: "Choose an MP4 video",
    replace: "Choose a different video",
    remove: "Remove",
    picked: "New video — it uploads when you save",
    current: "Current video",
    /** `length` "0:30", `size` "12 MB". */
    meta: (length: string, size: string) => `${length} long · ${size}`,
    measuring: "reading its length…",
    lengthUnknown: "its length can’t be read here — the server measures it",
    hint: "An MP4 video file, up to 200 MB and 10 minutes long. It plays exactly as you upload it.",
  },
  /** components/ads/AdImageField.tsx */
  picture: {
    label: "Picture",
    empty: "No picture yet",
    choose: "Choose a picture",
    replace: "Choose a different picture",
    remove: "Remove",
    picked: "New picture — it uploads when you save",
    current: "Current picture",
    size: (width: number, height: number) => `${width} × ${height}`,
    /** Said of an animated GIF. */
    moving: "moving",
    reading: "reading…",
    unreadable: "can’t be read",
    hint: "A PNG, JPG, WebP or GIF picture, up to 3 MB. It shows small — at most a quarter of the screen’s width — so a wide, short picture with big text works best. Animated GIFs keep moving.",
    gifHeavy:
      "This GIF is over 1 MB. It may load slowly on phones and use up viewers’ data — a smaller file is better.",
  },
  /** components/ads/CornerPreview.tsx */
  preview: {
    label: "Preview of the movie with the corner picture",
    theMovie: "the movie",
    placeholder: "Your picture",
    adTag: "Ad",
    close: "Close",
    caption: "Preview — top right, about this size on a big screen.",
    hiddenNote:
      "It hides while the movie is paused or loading, during video ads, in the last 2 minutes, and on phones while the play buttons are on screen.",
  },
  where: {
    groupLabel: "Where it plays",
    options: {
      BEFORE: { title: "Before the movie", description: "Plays once when someone starts a movie." },
      BREAKS: { title: "At ad breaks", description: "Plays when the movie pauses for an ad break." },
      BOTH: { title: "Both", description: "Before the movie and at ad breaks." },
    },
    /** `time` "30 min", "1 h". */
    breaksEvery: (time: string) => `Ad breaks now come every ${time} of a movie.`,
    breaksOff: "Ad breaks are off in Ad settings right now, so this ad won’t play at breaks until they are turned on.",
    /** `{settings}` becomes a link to the Ad settings. */
    changeInSettings: "You can change this in {settings}.",
    skipLabel: "Can viewers skip it?",
    skipNo: "No — they watch all of it",
    skipYes: "Yes, after a few seconds",
    /** `{n}` becomes the seconds box. */
    skipAfter: "Skip button appears after {n} seconds",
    skipAfterLabel: "Seconds before the Skip button",
    skipExample: "Example: 5 — viewers watch 5 seconds, then can press Skip.",
    /** `length` "0:30". */
    skipShorter: (length: string) => `Must be shorter than the video (${length}).`,
  },
  look: {
    stayLabel: "How long does it stay?",
    stayFor: "A few seconds",
    stayUntilClosed: "Until the viewer closes it",
    /** `{n}` becomes the seconds box. */
    staySeconds: "Stays {n} seconds",
    staySecondsLabel: "Seconds on screen",
    repeatLabel: "Does it come back?",
    repeatEvery: "Yes, every few minutes",
    repeatOnce: "Only once",
    /** `{n}` becomes the minutes box. */
    repeatMinutes: "Every {n} min of watching",
    repeatMinutesLabel: "Minutes of watching before it comes back",
    repeatUntilClosed: "It shows once and stays until the viewer closes it.",
    closableLabel: "Viewers can close it (✕)",
    closableHint: "Once closed, it doesn’t come back for the rest of that viewing.",
    closableForced: "Always on when it stays until the viewer closes it.",
    /** The timing in one sentence; the slots are shown in bold. */
    timeline: {
      repeat: "Appears after {first} of watching, stays {stay}, and comes back every {every} of watching.",
      once: "Appears after {first} of watching, stays {stay}, and doesn’t come back.",
      untilClosed: "Appears after {first} of watching and stays until the viewer closes it.",
    },
    seconds: (n: number) => (n === 1 ? "1 second" : `${n} seconds`),
    minutes: (n: number) => (n === 1 ? "1 minute" : `${n} minutes`),
    lastMinutesNote:
      "It never appears in the last 2 minutes of a movie, so a movie of 3 minutes or less never shows it.",
    pausingNote: "Pausing doesn’t count as watching.",
  },
  movies: {
    groupLabel: "Which movies",
    options: {
      ALL: {
        title: "All movies and episodes",
        description: "Every movie and every series episode, including ones you add later.",
      },
      SELECTED: {
        title: "Only movies I choose",
        description: "Only in the movies you tick below. Not in series episodes.",
      },
    },
  },
  /** components/ads/MoviePicker.tsx */
  picker: {
    search: "Search movies by name",
    hint: (count: number, max: number) => `Search by name and tick the movies. ${count} chosen (up to ${max}).`,
    noneChosen: "No movies chosen yet.",
    chosen: "Chosen:",
    noResults: "No movies match.",
    loadError: "Could not search the movies.",
    notPublished: "Not published",
    deleted: "Deleted movie",
    remove: (title: string) => `Remove ${title}`,
    /** `length` "1 h 52 min". */
    meta: (year: number, length: string) => `Movie · ${year} · ${length}`,
    metaYear: (year: number) => `Movie · ${year}`,
  },
  when: {
    startsLabel: "Starts",
    startsNow: "Right away",
    onDate: "On a date",
    endsLabel: "Ends",
    endsNever: "Never — until I turn it off",
    startDate: "Start date",
    startTime: "Start time",
    endDate: "End date",
    endTime: "End time",
    /** Between the date box and the time box. */
    at: "at",
    /** "30 Nov 2026 at 23:59" */
    dateAt: (date: string, time: string) => `${date} at ${time}`,
    /** The schedule in one sentence; `{start}` / `{end}` are shown in bold. */
    sentences: {
      nowNever: "Starts as soon as you turn it on and keeps showing until you turn it off.",
      nowEnd: "Starts as soon as you turn it on and stops on {end}.",
      startNever: "Starts on {start} and keeps showing until you turn it off.",
      startEnd: "Starts on {start} and stops on {end}.",
      startedNever: "Started on {start} and keeps showing until you turn it off.",
      startedEnd: "Started on {start} and stops on {end}.",
    },
    timesNote: "All dates and times are Myanmar time.",
  },
  /** components/ads/wizard/MoreOptions.tsx (the `Wiz5More` board, SPEC §2). */
  more: {
    title: "More options",
    notNeeded: "most ads don’t need these",
    set: (n: number) => `${n} set`,
    intro: "These make the ad show less often. Your own test views count too.",
    hours: {
      label: "Only at certain hours of the day",
      /** `{from}` / `{to}` become the time boxes. */
      range: "From {from} to {to} every day",
      fromLabel: "From (time of day)",
      toLabel: "To (time of day)",
      example:
        "Example: 18:00 to 23:00 — evenings only. If the end is earlier than the start (22:00 to 02:00), it runs past midnight.",
      overnight: "This runs past midnight.",
    },
    wait: {
      label: "Make each viewer wait before seeing it again",
      /** `{n}` becomes the minutes box. */
      input: "Wait {n} minutes",
      inputLabel: "Minutes to wait",
      examples: {
        VIDEO:
          "Example: 60 — after someone sees this ad, it won’t show to them again for an hour. Other ads can play in between.",
        CORNER:
          "Example: 60 — after someone sees this picture in a movie, it won’t show to them again for an hour. Other ads can show in between.",
      },
    },
    perDay: {
      label: "Limit how many times one viewer sees it in a day",
      /** `{n}` becomes the number box. */
      input: "At most {n} times a day",
      inputLabel: "Most times a day",
      examples: {
        VIDEO: "Example: 3 — each viewer sees it at most 3 times a day. After that, other ads play instead.",
        CORNER:
          "Example: 3 — each viewer sees it in at most 3 movies a day. Each movie it appears in counts as one time.",
      },
    },
    priority: {
      label: "Which ad goes first",
      text: "When several ads could play in the same place, the one with the higher number plays. Ads with the same number take turns. Leave it at 0 unless this ad must always win.",
    },
  },
  review: {
    editIntro: "Tap any part above, or “Change” below, to edit it. You can save from any part.",
    /** The summary, as short whole sentences; every slot is shown in bold. */
    sentences: {
      /** `{length}` carries its own "a" or "an" (`videoLength`). */
      videoIs: "{name} is {length} video.",
      videoNoLength: "{name} is a video ad.",
      videoNone: "{name} has no video yet.",
      cornerIs: "{name} is a corner picture.",
      videoPlays: "It plays {where} in {movies}.",
      cornerShows: "It shows in {movies}.",
      hours: "It shows only {from}–{to} each day.",
      noEnd: "It has no end date.",
      endsOn: "It ends {end}.",
      endedOn: "It ended {end}.",
      startsNoEnd: "It starts {start} and has no end date.",
      startedNoEnd: "It started {start} and has no end date.",
      startsEnds: "It starts {start} and ends {end}.",
      startedEnds: "It started {start} and ends {end}.",
      skip: (n: number): string =>
        n === 1 ? "Viewers can skip it after {n} second." : "Viewers can skip it after {n} seconds.",
      noSkip: "Viewers can’t skip it.",
      link: "Tapping it opens {host}.",
      noLink: "Tapping it does nothing.",
      turnedOn: "It is turned on.",
      turnedOff: "It is turned off.",
    },
    /** A video's length inside a sentence: "a 30-second" video, "an 8-second" video. */
    videoLength: {
      seconds: (s: number) => `${aOr(s)} ${s}-second`,
      minutes: (m: number) => `${aOr(m)} ${m}-minute`,
      minutesSeconds: (m: number, s: number) => `${aOr(m)} ${m} min ${s} s`,
    },
    /** Where a video ad plays, inside a sentence. */
    slots: {
      before: "before the movie",
      breaks: "at ad breaks",
      both: "before the movie and at ad breaks",
    },
    /** Which movies, inside a sentence. */
    movies: {
      all: "all movies and episodes",
      chosen: (count: number) => (count === 1 ? "1 chosen movie" : `${count} chosen movies`),
    },
    rows: {
      type: "Type",
      video: "Video",
      picture: "Picture",
      link: "Web page",
      where: "Where",
      timing: "Timing",
      movies: "Movies",
      when: "When",
      more: "More options",
      note: "Private note",
    },
    values: {
      picked: (fileName: string, detail: string) => `${fileName} · ${detail}`,
      videoLong: (length: string) => `${length} long`,
      currentVideo: "Current video",
      noVideo: "No video yet",
      currentPicture: "Current picture",
      noPicture: "No picture yet",
      noLink: "None — tapping does nothing",
      skipAfter: (n: number) => (n === 1 ? "skip after 1 second" : `skip after ${n} seconds`),
      noSkip: "can’t be skipped",
      stays: (n: string) => `Stays ${n} seconds`,
      staysUntilClosed: "Stays until the viewer closes it",
      comesBack: (n: string) => `comes back every ${n} min of watching`,
      once: "shows once",
      closable: "viewers can close it",
      notClosable: "can’t be closed",
      chosenList: (count: number, names: string) => `${count} chosen: ${names}`,
      moreNames: (n: number) => `+${n} more`,
      deletedMovie: "Deleted movie",
      listSeparator: ", ",
      fromNowNoEnd: "From now · no end date",
      fromNowUntil: (end: string) => `From now until ${end}`,
      fromNoEnd: (start: string) => `From ${start} · no end date`,
      fromUntil: (start: string, end: string) => `From ${start} until ${end}`,
      startedNoEnd: (start: string) => `Started ${start} · no end date`,
      startedUntil: (start: string, end: string) => `Started ${start} · ends ${end}`,
      hours: (from: string, to: string) => `Only ${from}–${to} each day`,
      wait: (n: number) => `Wait ${n} min before the same viewer sees it again`,
      /** A corner picture counts once per movie it appears in, however often it comes back. */
      perDay: {
        VIDEO: (n: number) => (n === 1 ? "At most once a day per viewer" : `At most ${n} times a day per viewer`),
        CORNER: (n: number) =>
          n === 1 ? "In at most 1 movie a day per viewer" : `In at most ${n} movies a day per viewer`,
      },
      priority: (n: number) => `Goes first: ${n}`,
      none: "None",
    },
    change: "Change",
    fix: "Fix",
    dotLegend: "A red dot means that part needs fixing before you can save.",
    active: {
      label: "Turn it on now?",
      yes: "Yes, start showing it",
      yesDescription: "Viewers can get it from the next movie they open.",
      yesNeedsVideo: "Add a video first — in the “Video” step.",
      yesNeedsPicture: "Add a picture first — in the “Picture” step.",
      no: "Not yet — save it turned off",
      noDescription: "Nobody sees it until you switch it on in the list.",
    },
    adsOffNote:
      "All ads are turned off in Ad settings right now, so viewers won’t see it until they are turned back on.",
  },
  /** One sentence per components/ads/adForm.ts AdIssueCode (adForm.ts `issueText`). */
  issues: {
    TITLE_REQUIRED: "Give the ad a name.",
    TITLE_TOO_LONG: (max: number) => `The ad name is too long — at most ${max} characters.`,
    DESCRIPTION_TOO_LONG: (max: number) => `The private note is too long — at most ${max} characters.`,
    VIDEO_NOT_MP4: "Choose an MP4 video file.",
    /** `max` "200 MB". */
    VIDEO_TOO_LARGE: (max: string) => `The video is bigger than ${max}. Choose a smaller file.`,
    VIDEO_DURATION: (minSeconds: number, maxMinutes: number) =>
      `The video must be between ${minSeconds === 1 ? "1 second" : `${minSeconds} seconds`} and ${maxMinutes} minutes long.`,
    TARGET_MOVIES_REQUIRED: "Tick at least one movie — or choose “All movies and episodes”.",
    TARGET_TOO_MANY: (max: number) => `You can choose at most ${max} movies.`,
    TARGET_DELETED: "A movie you chose was deleted. Remove it (shown in red) before saving.",
    WINDOW_INVALID: "The end date must be after the start date.",
    DAILY_WINDOW_INCOMPLETE: "Fill in both hours of the day — from and to.",
    DAILY_WINDOW_SAME: "The two hours of the day can’t be the same.",
    PRIORITY_RANGE: (min: number, max: number) =>
      `“Which ad goes first” must be a whole number from ${min} to ${max}.`,
    SKIP_AFTER_REQUIRED: "Enter after how many seconds viewers can skip.",
    SKIP_AFTER_RANGE: (min: number, max: number) =>
      `The skip time must be a whole number from ${min} to ${max} seconds.`,
    /** `length` "0:15". */
    SKIP_AFTER_TOO_LONG: (length: string) => `The skip time must be shorter than the video (${length}).`,
    FREQUENCY_RANGE: (min: number, max: number) => `The wait must be a whole number from ${min} to ${max} minutes.`,
    MAX_PER_DAY_RANGE: (min: number, max: number) => `The daily limit must be a whole number from ${min} to ${max}.`,
    SLOTS_REQUIRED: "Choose where it plays: before the movie, at ad breaks, or both.",
    VIDEO_REQUIRED: "Add a video to turn it on now — or choose “Not yet — save it turned off”.",
    PICTURE_TYPE: "Choose a PNG, JPG, WebP or GIF picture.",
    /** `max` "3 MB". */
    PICTURE_TOO_LARGE: (max: string) => `The picture is bigger than ${max}. Choose a smaller file.`,
    PICTURE_UNREADABLE: "This picture can’t be read. Choose another file.",
    PICTURE_SHAPE: (minSide: number, maxAspect: number) =>
      `Each side of the picture must be at least ${minSide} pixels, and the long side at most ${maxAspect} times the short side.`,
    LINK_TOO_LONG: (max: number) => `The web page address is too long — at most ${max} characters.`,
    LINK_INVALID:
      "This web page address won’t work. It must start with https:// or http:// and be a web address (like https://example.com), with no spaces.",
    CORNER_SHOW_RANGE: (min: number, max: number) =>
      `The seconds it stays must be a whole number from ${min} to ${max}.`,
    CORNER_REPEAT_RANGE: (min: number, max: number) =>
      `The minutes before it comes back must be a whole number from ${min} to ${max}.`,
    CORNER_REPEAT_TOO_SHORT: "It must come back later than it stays on screen — use more minutes, or fewer seconds.",
    PICTURE_REQUIRED: "Add a picture to turn it on now — or choose “Not yet — save it turned off”.",
    /** The wizard's own: “On a date” chosen, but no date picked yet. */
    START_DATE_MISSING: "Choose the start date — or choose “Right away”.",
    END_DATE_MISSING: "Choose the end date — or choose “Never”.",
  },
  /** Backend refusals with no form check of their own (adForm.ts `adErrorMessage`). */
  server: {
    skipTooLong: "The skip time must be shorter than the video.",
    pictureRequired: "Add a picture before turning it on.",
  },
};

export const wizardMm = {
  titles: {
    newAd: "ကြော်ငြာ အသစ်",
    newCorner: "ထောင့်ပုံ ကြော်ငြာ အသစ်",
    edit: (name: string) => `“${name}” ကို ပြင်မည်`,
    typeFixed: (type: string) => `${type} · အမျိုးအစားကို ပြောင်း၍ မရပါ`,
  },
  steps: {
    listLabel: "အဆင့်များ",
    partsLabel: "ဤကြော်ငြာ၏ အပိုင်းများ",
    names: {
      type: "အမျိုးအစား",
      video: "ဗီဒီယို",
      picture: "ပုံ",
      where: "ပြမည့်နေရာ",
      look: "ပေါ်ချိန်",
      movies: "ရုပ်ရှင်များ",
      when: "ပြမည့်အချိန်",
      check: "စစ်ဆေးရန်",
      summary: "အနှစ်ချုပ်",
    },
    numbered: (n: number, name: string) => `${n} ${name}`,
    done: "ပြီးပြီ",
    hasProblem: "ပြင်ရန် ရှိသည်",
    stepOf: (n: number, total: number, name: string) => `အဆင့် ${n} / ${total} · ${name}`,
    progress: (n: number, total: number) => `အဆင့် ${n} / ${total}`,
  },
  headings: {
    type: "ကြော်ငြာ အမျိုးအစား ဘာလဲ",
    mediaVideo: "ဗီဒီယိုနှင့် အမည် ထည့်ပါ",
    mediaCorner: "ပုံ၊ အမည်နှင့် လင့်ခ် ထည့်ပါ",
    where: "ဘယ်နေရာမှာ ပြမလဲ",
    look: "ပုံကို ဘယ်လို ပေါ်စေမလဲ",
    movies: "ဘယ်ရုပ်ရှင်များတွင် ပြမလဲ",
    when: "ဘယ်အချိန်မှာ ပြမလဲ",
    check: "စစ်ဆေးပြီး သိမ်းပါ",
    summary: "အနှစ်ချုပ်",
  },
  footer: {
    saveAd: "ကြော်ငြာ သိမ်းမည်",
    saveChanges: "ပြင်ဆင်ချက်များ သိမ်းမည်",
    stopUpload: "တင်ခြင်း ရပ်မည်",
    saving: "သိမ်းနေသည်…",
    uploadingVideo: (percent: number) => `ဗီဒီယို တင်နေသည်… ${percent}%`,
    checkingVideo: "ဗီဒီယိုကို စစ်ဆေးနေသည်…",
    uploadingPicture: "ပုံ တင်နေသည်…",
  },
  problems: {
    beforeNext: "ရှေ့ဆက်မသွားမီ အောက်ပါအချက်ကို ပြင်ပါ။",
    beforeSave: "မသိမ်းမီ အောက်ပါအချက်ကို ပြင်ပါ။",
  },
  closeConfirm: {
    title: "မသိမ်းဘဲ ပိတ်မလား။",
    description: "ဤကြော်ငြာတွင် ပြင်ထားသည်များ ပျောက်သွားပါမည်။",
    savedTitle: "ယခု ပိတ်မလား။",
    savedDescription:
      "ကြော်ငြာကို စာရင်းထဲတွင် ပိတ်ထားလျက် သိမ်းပြီး ဖြစ်သည်။ ထို့နောက် ပြင်ထားသည်များနှင့် တင်ရန် ကျန်နေသော ဗီဒီယို သို့မဟုတ် ပုံသာ ပျောက်သွားပါမည်။",
    videoKept: "ဗီဒီယို အသစ်သည် ဤကြော်ငြာတွင် ရောက်ရှိပြီး ဆက်ရှိနေပါမည်။ အခြား ပြင်ထားသည်များသာ ပျောက်သွားပါမည်။",
    pictureKept: "ပုံ အသစ်သည် ဤကြော်ငြာတွင် ရောက်ရှိပြီး ဆက်ရှိနေပါမည်။ အခြား ပြင်ထားသည်များသာ ပျောက်သွားပါမည်။",
    confirm: "မသိမ်းဘဲ ပိတ်မည်",
    keepEditing: "ဆက်ပြင်မည်",
  },
  toasts: {
    created: "ကြော်ငြာ ဖန်တီးပြီးပါပြီ",
    updated: "ပြင်ဆင်ချက်များ သိမ်းပြီးပါပြီ",
    stopped: "တင်ခြင်းကို ရပ်လိုက်ပါပြီ",
    videoRefused: "ကြော်ငြာကို သိမ်းပြီးသော်လည်း ဗီဒီယိုကို လက်မခံပါ",
    pictureRefused: "ကြော်ငြာကို သိမ်းပြီးသော်လည်း ပုံကို လက်မခံပါ",
    videoKept: "ဗီဒီယို အသစ်သည် ကြော်ငြာတွင် ရောက်ရှိပြီးသော်လည်း အခြား ပြင်ထားသည်များကို သိမ်း၍ မရပါ",
    pictureKept: "ပုံ အသစ်သည် ကြော်ငြာတွင် ရောက်ရှိပြီးသော်လည်း အခြား ပြင်ထားသည်များကို သိမ်း၍ မရပါ",
    saveFailed: "ကြော်ငြာကို သိမ်း၍ မရပါ",
  },
  type: {
    groupLabel: "ကြော်ငြာ အမျိုးအစား",
    descriptions: {
      VIDEO: "ရုပ်ရှင် မစမီ သို့မဟုတ် ကြားဖြတ်ကြော်ငြာ အချိန်တွင် ပြမည့် ဗီဒီယို အတို။",
      CORNER:
        "ရုပ်ရှင် ပြနေစဉ် မျက်နှာပြင် ထောင့်တွင် ပေါ်မည့် ပုံအသေး။ ကြည့်သူများ နှိပ်လျှင် သင့်ဝက်ဘ်စာမျက်နှာ ပွင့်ပါမည်။",
    },
    theMovie: "ရုပ်ရှင်",
    fixedNote: "သိမ်းပြီးနောက် အမျိုးအစားကို ပြောင်း၍ မရပါ။",
    fixedNow: "ဤကြော်ငြာကို သိမ်းပြီး ဖြစ်၍ အမျိုးအစားကို ယခု ပြောင်း၍ မရတော့ပါ။",
  },
  media: {
    nameLabel: "ကြော်ငြာ အမည်",
    nameHints: {
      VIDEO: "ကြော်ငြာ ပြနေစဉ် ၎င်း၏ အပေါ်တွင် ကြည့်သူများ ဤအမည်ကို မြင်ရပါမည်။",
      CORNER: "ဤအမည်ကို သင်သာ မြင်ရပါမည်။ ကြည့်သူများ ပုံကိုသာ မြင်ရပါမည်။",
    },
    noteLabel: "ဝန်ထမ်းသာ မြင်ရသော မှတ်စု",
    notePlaceholders: {
      VIDEO: "ဥပမာ — 30 Nov အထိ ငွေချေပြီး၊ ကိုအောင်ကို ဆက်သွယ်ရန်",
      CORNER: "ဥပမာ — စပွန်ဆာက တစ်ပတ်ချင်း ငွေချေသည်",
    },
    noteHint: "ဝန်ထမ်းများသာ မြင်ရပါမည်။ ကြည့်သူများ ဘယ်တော့မှ မမြင်ရပါ။",
    linkLabel: "နှိပ်လျှင် ဖွင့်မည့် ဝက်ဘ်စာမျက်နှာ",
    linkPlaceholder: "https://www.example.com/offer",
    linkHint:
      "ကြည့်သူများ ပုံကို နှိပ်လျှင် ဤစာမျက်နှာ ပွင့်ပါမည်။ https:// သို့မဟုတ် http:// ဖြင့် စရပါမည်။ နှိပ်လျှင် ဘာမှ မဖြစ်စေလိုပါက ချန်ထားပါ။",
  },
  video: {
    label: "ဗီဒီယို",
    empty: "ဗီဒီယို မရှိသေးပါ",
    choose: "MP4 ဗီဒီယို ရွေးမည်",
    replace: "အခြား ဗီဒီယို ရွေးမည်",
    remove: "ဖယ်ရှားမည်",
    picked: "ဗီဒီယို အသစ် — သိမ်းသောအခါ တင်ပါမည်",
    current: "လက်ရှိ ဗီဒီယို",
    meta: (length: string, size: string) => `${length} ကြာ · ${size}`,
    measuring: "ကြာချိန် ဖတ်နေသည်…",
    lengthUnknown: "ကြာချိန်ကို ဤနေရာတွင် ဖတ်၍ မရပါ — ဆာဗာက တိုင်းပါမည်",
    hint: "MP4 ဗီဒီယိုဖိုင်၊ အများဆုံး 200 MB နှင့် 10 မိနစ်။ တင်ထားသည့်အတိုင်း အတိအကျ ပြပါမည်။",
  },
  picture: {
    label: "ပုံ",
    empty: "ပုံ မရှိသေးပါ",
    choose: "ပုံ ရွေးမည်",
    replace: "အခြား ပုံ ရွေးမည်",
    remove: "ဖယ်ရှားမည်",
    picked: "ပုံ အသစ် — သိမ်းသောအခါ တင်ပါမည်",
    current: "လက်ရှိ ပုံ",
    size: (width: number, height: number) => `${width} × ${height}`,
    moving: "လှုပ်ရှားသည်",
    reading: "ဖတ်နေသည်…",
    unreadable: "ဖတ်၍ မရပါ",
    hint: "PNG, JPG, WebP သို့မဟုတ် GIF ပုံ၊ အများဆုံး 3 MB။ မျက်နှာပြင် အကျယ်၏ လေးပုံတစ်ပုံထက် မကျော်ဘဲ သေးသေးလေး ပြသဖြင့် စာလုံးကြီးကြီး ပါသော အလျားရှည်ပြီး အမြင့်နိမ့်သည့် ပုံက အကောင်းဆုံး ဖြစ်သည်။ လှုပ်ရှားသော GIF များ ဆက်လှုပ်နေပါမည်။",
    gifHeavy:
      "ဤ GIF သည် 1 MB ထက် ကြီးပါသည်။ ဖုန်းများတွင် နှေးနိုင်ပြီး ကြည့်သူများ၏ ဒေတာ ကုန်နိုင်သဖြင့် ဖိုင်အသေးက ပိုကောင်းပါသည်။",
  },
  preview: {
    label: "ထောင့်ပုံ ကြော်ငြာ ပါသော ရုပ်ရှင်၏ နမူနာ",
    theMovie: "ရုပ်ရှင်",
    placeholder: "သင့်ပုံ",
    adTag: "ကြော်ငြာ",
    close: "ပိတ်ရန်",
    caption: "နမူနာ — ညာဘက် အပေါ်ထောင့်၊ မျက်နှာပြင်ကြီးတွင် ဤအရွယ်ခန့်။",
    hiddenNote:
      "ရုပ်ရှင်ကို ခဏရပ်ထားစဉ် သို့မဟုတ် ဖွင့်နေစဉ်၊ ဗီဒီယို ကြော်ငြာ ပြနေစဉ်၊ နောက်ဆုံး 2 မိနစ်အတွင်းနှင့် ဖုန်းတွင် ဖွင့်/ရပ် ခလုတ်များ ပေါ်နေစဉ် ဖျောက်ထားပါသည်။",
  },
  where: {
    groupLabel: "ပြမည့်နေရာ",
    options: {
      BEFORE: { title: "ရုပ်ရှင် မစမီ", description: "ရုပ်ရှင် စဖွင့်တိုင်း တစ်ကြိမ် ပြပါမည်။" },
      BREAKS: {
        title: "ကြားဖြတ်ကြော်ငြာ အချိန်တွင်",
        description: "ရုပ်ရှင်ကို ကြားဖြတ်ကြော်ငြာအတွက် ခဏရပ်သည့်အခါ ပြပါမည်။",
      },
      BOTH: { title: "နှစ်ခုလုံး", description: "ရုပ်ရှင် မစမီနှင့် ကြားဖြတ်ကြော်ငြာ အချိန်တွင်။" },
    },
    breaksEvery: (time: string) => `ယခု ရုပ်ရှင်ကို ${time} ကြည့်ပြီးတိုင်း ကြားဖြတ်ကြော်ငြာ တစ်ခု ပြပါသည်။`,
    breaksOff:
      "ယခု ကြော်ငြာ ဆက်တင်တွင် ကြားဖြတ်ကြော်ငြာကို ပိတ်ထားသဖြင့် ပြန်ဖွင့်သည်အထိ ဤကြော်ငြာကို ကြားဖြတ်ကြော်ငြာ အချိန်တွင် မပြပါ။",
    changeInSettings: "{settings} တွင် ပြောင်းနိုင်ပါသည်။",
    skipLabel: "ကြည့်သူများ ကျော်နိုင်မလား",
    skipNo: "မကျော်နိုင်ပါ — အဆုံးထိ ကြည့်ရမည်",
    skipYes: "ကျော်နိုင်သည် — စက္ကန့်အနည်းငယ် ကြာပြီးနောက်",
    skipAfter: "{n} စက္ကန့် ကြာပြီးနောက် ကျော်ရန် ခလုတ် ပေါ်မည်",
    skipAfterLabel: "ကျော်ရန် ခလုတ် မပေါ်မီ စက္ကန့်",
    skipExample: "ဥပမာ — 5 ဆိုလျှင် ကြည့်သူများ 5 စက္ကန့် ကြည့်ပြီးနောက် ကျော်ရန် ခလုတ်ကို နှိပ်နိုင်ပါမည်။",
    skipShorter: (length: string) => `ဗီဒီယို ကြာချိန် (${length}) ထက် တိုရပါမည်။`,
  },
  look: {
    stayLabel: "ဘယ်လောက်ကြာ ပေါ်နေမလဲ",
    stayFor: "စက္ကန့် အနည်းငယ်",
    stayUntilClosed: "ကြည့်သူ ပိတ်သည်အထိ",
    staySeconds: "{n} စက္ကန့် ပေါ်နေမည်",
    staySecondsLabel: "ပေါ်နေမည့် စက္ကန့်",
    repeatLabel: "ပြန်ပေါ်မလား",
    repeatEvery: "ပြန်ပေါ်မည် — မိနစ်အနည်းငယ်တိုင်း",
    repeatOnce: "တစ်ကြိမ်သာ",
    repeatMinutes: "ကြည့်ချိန် {n} မိနစ်တိုင်း",
    repeatMinutesLabel: "ပြန်မပေါ်မီ ကြည့်ရမည့် မိနစ်",
    repeatUntilClosed: "တစ်ကြိမ်သာ ပေါ်ပြီး ကြည့်သူ ပိတ်သည်အထိ ရှိနေပါမည်။",
    closableLabel: "ကြည့်သူများ ပိတ်နိုင်သည် (✕)",
    closableHint: "ပိတ်လိုက်လျှင် ထိုကြည့်မှု၏ ကျန်အချိန်အတွင်း ထပ်မပေါ်တော့ပါ။",
    closableForced: "ကြည့်သူ ပိတ်သည်အထိ ပေါ်နေမည်ဆိုလျှင် အမြဲ ဖွင့်ထားရပါမည်။",
    timeline: {
      repeat: "ကြည့်ချိန် {first} ပြည့်လျှင် ပေါ်လာပြီး {stay} ကြာ ရှိနေကာ ကြည့်ချိန် {every} တိုင်း ပြန်ပေါ်ပါမည်။",
      once: "ကြည့်ချိန် {first} ပြည့်လျှင် ပေါ်လာပြီး {stay} ကြာ ရှိနေကာ ပြန်မပေါ်တော့ပါ။",
      untilClosed: "ကြည့်ချိန် {first} ပြည့်လျှင် ပေါ်လာပြီး ကြည့်သူ ပိတ်သည်အထိ ရှိနေပါမည်။",
    },
    seconds: (n: number) => `${n} စက္ကန့်`,
    minutes: (n: number) => `${n} မိနစ်`,
    lastMinutesNote:
      "ရုပ်ရှင်၏ နောက်ဆုံး 2 မိနစ်အတွင်း ဘယ်တော့မှ မပေါ်ပါ။ ထို့ကြောင့် 3 မိနစ် သို့မဟုတ် ထို့ထက် တိုသော ရုပ်ရှင်တွင် လုံးဝ မပေါ်ပါ။",
    pausingNote: "ခဏရပ်ထားချိန်ကို ကြည့်ချိန်အဖြစ် မရေတွက်ပါ။",
  },
  movies: {
    groupLabel: "ရုပ်ရှင်များ",
    options: {
      ALL: {
        title: "ရုပ်ရှင်အားလုံးနှင့် ဇာတ်လမ်းတွဲ အပိုင်းအားလုံး",
        description: "ရုပ်ရှင်တိုင်းနှင့် ဇာတ်လမ်းတွဲ အပိုင်းတိုင်း၊ နောက်မှ ထည့်မည့်ဟာများ အပါအဝင်။",
      },
      SELECTED: {
        title: "ကျွန်ုပ် ရွေးသော ရုပ်ရှင်များသာ",
        description: "အောက်တွင် အမှန်ခြစ်ထားသော ရုပ်ရှင်များတွင်သာ။ ဇာတ်လမ်းတွဲ အပိုင်းများတွင် မပြပါ။",
      },
    },
  },
  picker: {
    search: "ရုပ်ရှင် အမည်ဖြင့် ရှာမည်",
    hint: (count: number, max: number) =>
      `အမည်ဖြင့် ရှာပြီး ရုပ်ရှင်များကို အမှန်ခြစ်ပါ။ ${count} ကား ရွေးထားသည် (အများဆုံး ${max})။`,
    noneChosen: "ရုပ်ရှင် မရွေးရသေးပါ။",
    chosen: "ရွေးထားသည် —",
    noResults: "ကိုက်ညီသော ရုပ်ရှင် မရှိပါ။",
    loadError: "ရုပ်ရှင်များကို ရှာ၍ မရပါ။",
    notPublished: "မထုတ်ပြန်ရသေး",
    deleted: "ဖျက်ထားသော ရုပ်ရှင်",
    remove: (title: string) => `${title} ကို ဖယ်ရှားမည်`,
    meta: (year: number, length: string) => `ရုပ်ရှင် · ${year} · ${length}`,
    metaYear: (year: number) => `ရုပ်ရှင် · ${year}`,
  },
  when: {
    startsLabel: "စမည့်အချိန်",
    startsNow: "ချက်ချင်း",
    onDate: "ရက်သတ်မှတ်၍",
    endsLabel: "ပြီးမည့်အချိန်",
    endsNever: "မပြီးပါ — ကျွန်ုပ် ပိတ်သည်အထိ",
    startDate: "စမည့်ရက်",
    startTime: "စမည့် နာရီ",
    endDate: "ပြီးမည့်ရက်",
    endTime: "ပြီးမည့် နာရီ",
    at: "—",
    dateAt: (date: string, time: string) => `${date} ${time}`,
    sentences: {
      nowNever: "ဖွင့်လိုက်သည်နှင့် စပြပြီး သင် ပိတ်သည်အထိ ဆက်ပြပါမည်။",
      nowEnd: "ဖွင့်လိုက်သည်နှင့် စပြပြီး {end} တွင် ရပ်ပါမည်။",
      startNever: "{start} တွင် စပြပြီး သင် ပိတ်သည်အထိ ဆက်ပြပါမည်။",
      startEnd: "{start} တွင် စပြပြီး {end} တွင် ရပ်ပါမည်။",
      startedNever: "{start} တွင် စပြခဲ့ပြီး သင် ပိတ်သည်အထိ ဆက်ပြပါမည်။",
      startedEnd: "{start} တွင် စပြခဲ့ပြီး {end} တွင် ရပ်ပါမည်။",
    },
    timesNote: "ရက်နှင့် အချိန်အားလုံးသည် မြန်မာစံတော်ချိန် ဖြစ်သည်။",
  },
  more: {
    title: "နောက်ထပ် ရွေးချယ်စရာများ",
    notNeeded: "ကြော်ငြာ အများစုတွင် မလိုပါ",
    set: (n: number) => `${n} ခု သတ်မှတ်ထားသည်`,
    intro: "ဤရွေးချယ်စရာများက ကြော်ငြာကို ပိုနည်းနည်း ပြစေပါသည်။ သင်ကိုယ်တိုင် စမ်းကြည့်ခြင်းများကိုလည်း ရေတွက်ပါသည်။",
    hours: {
      label: "နေ့စဉ် သတ်မှတ်ထားသော အချိန်များတွင်သာ",
      range: "နေ့စဉ် {from} မှ {to} အထိ",
      fromLabel: "စမည့် နာရီ",
      toLabel: "ပြီးမည့် နာရီ",
      example:
        "ဥပမာ — 18:00 မှ 23:00 ဆိုလျှင် ညနေပိုင်းသာ ပြပါမည်။ ပြီးမည့်အချိန်သည် စမည့်အချိန်ထက် စောလျှင် (22:00 မှ 02:00) သန်းခေါင်ကျော်အထိ ပြပါမည်။",
      overnight: "သန်းခေါင်ကျော်အထိ ပြပါမည်။",
    },
    wait: {
      label: "တစ်ခါမြင်ပြီးလျှင် ထပ်မမြင်ရခင် ကြည့်သူကို စောင့်ခိုင်းရန်",
      input: "{n} မိနစ် စောင့်ခိုင်းမည်",
      inputLabel: "စောင့်ရမည့် မိနစ်",
      examples: {
        VIDEO:
          "ဥပမာ — 60 ဆိုလျှင် တစ်ယောက်ယောက် ဤကြော်ငြာကို မြင်ပြီးနောက် တစ်နာရီအတွင်း ထိုသူ့ကို ထပ်မပြပါ။ ကြားတွင် အခြားကြော်ငြာများ ပြနိုင်ပါသည်။",
        CORNER:
          "ဥပမာ — 60 ဆိုလျှင် တစ်ယောက်ယောက် ဤပုံကို ရုပ်ရှင်တစ်ကားတွင် မြင်ပြီးနောက် တစ်နာရီအတွင်း ထိုသူ့ကို ထပ်မပြပါ။ ကြားတွင် အခြားကြော်ငြာများ ပြနိုင်ပါသည်။",
      },
    },
    perDay: {
      label: "ကြည့်သူတစ်ဦး တစ်ရက်လျှင် မြင်ရမည့် အကြိမ်ရေ ကန့်သတ်ရန်",
      input: "တစ်ရက်လျှင် အများဆုံး {n} ကြိမ်",
      inputLabel: "တစ်ရက်လျှင် အများဆုံး အကြိမ်ရေ",
      examples: {
        VIDEO:
          "ဥပမာ — 3 ဆိုလျှင် ကြည့်သူတစ်ဦးစီ တစ်ရက်လျှင် အများဆုံး 3 ကြိမ်သာ မြင်ရပါမည်။ ထို့နောက် အခြားကြော်ငြာများ ပြပါမည်။",
        CORNER:
          "ဥပမာ — 3 ဆိုလျှင် ကြည့်သူတစ်ဦးစီ တစ်ရက်လျှင် ရုပ်ရှင် 3 ကားအထိသာ မြင်ရပါမည်။ ပေါ်ခဲ့သော ရုပ်ရှင်တစ်ကားကို တစ်ကြိမ်အဖြစ် ရေတွက်ပါသည်။",
      },
    },
    priority: {
      label: "ဘယ်ကြော်ငြာ အရင်ပြမလဲ",
      text: "ကြော်ငြာ အများအပြားကို တစ်နေရာတည်းတွင် ပြနိုင်သည့်အခါ နံပါတ် ပိုကြီးသော ကြော်ငြာကို ပြပါမည်။ နံပါတ်တူ ကြော်ငြာများ တစ်လှည့်စီ ပြပါမည်။ ဤကြော်ငြာ အမြဲ အနိုင်ရရန် မလိုလျှင် 0 အတိုင်း ထားပါ။",
    },
  },
  review: {
    editIntro:
      "ပြင်လိုသော အပိုင်းကို အပေါ်တွင် နှိပ်ပါ သို့မဟုတ် အောက်ရှိ “ပြောင်းမည်” ကို နှိပ်ပါ။ မည်သည့် အပိုင်းမှမဆို သိမ်းနိုင်ပါသည်။",
    sentences: {
      videoIs: "{name} သည် {length} ကြာ ဗီဒီယို ဖြစ်သည်။",
      videoNoLength: "{name} သည် ဗီဒီယို ကြော်ငြာ ဖြစ်သည်။",
      videoNone: "{name} တွင် ဗီဒီယို မရှိသေးပါ။",
      cornerIs: "{name} သည် ထောင့်ပုံ ကြော်ငြာ ဖြစ်သည်။",
      videoPlays: "{movies} တွင် {where} ပြပါမည်။",
      cornerShows: "{movies} တွင် ပေါ်ပါမည်။",
      hours: "နေ့စဉ် {from}–{to} အတွင်းသာ ပြပါမည်။",
      noEnd: "ပြီးမည့်ရက် မရှိပါ။",
      endsOn: "{end} တွင် ပြီးပါမည်။",
      endedOn: "{end} တွင် ပြီးခဲ့ပါပြီ။",
      startsNoEnd: "{start} တွင် စပြီး ပြီးမည့်ရက် မရှိပါ။",
      startedNoEnd: "{start} တွင် စခဲ့ပြီး ပြီးမည့်ရက် မရှိပါ။",
      startsEnds: "{start} တွင် စပြီး {end} တွင် ပြီးပါမည်။",
      startedEnds: "{start} တွင် စခဲ့ပြီး {end} တွင် ပြီးပါမည်။",
      skip: () => "ကြည့်သူများ {n} စက္ကန့် ကြာပြီးနောက် ကျော်နိုင်ပါသည်။",
      noSkip: "ကြည့်သူများ ကျော်၍ မရပါ။",
      link: "နှိပ်လျှင် {host} ပွင့်ပါမည်။",
      noLink: "နှိပ်လျှင် ဘာမှ မဖြစ်ပါ။",
      turnedOn: "ယခု ဖွင့်ထားပါသည်။",
      turnedOff: "ယခု ပိတ်ထားပါသည်။",
    },
    videoLength: {
      seconds: (s: number) => `${s} စက္ကန့်`,
      minutes: (m: number) => `${m} မိနစ်`,
      minutesSeconds: (m: number, s: number) => `${m} မိနစ် ${s} စက္ကန့်`,
    },
    slots: {
      before: "ရုပ်ရှင် မစမီ",
      breaks: "ကြားဖြတ်ကြော်ငြာ အချိန်တွင်",
      both: "ရုပ်ရှင် မစမီနှင့် ကြားဖြတ်ကြော်ငြာ အချိန်တွင်",
    },
    movies: {
      all: "ရုပ်ရှင်အားလုံးနှင့် ဇာတ်လမ်းတွဲ အပိုင်းအားလုံး",
      chosen: (count: number) => `ရွေးထားသော ရုပ်ရှင် ${count} ကား`,
    },
    rows: {
      type: "အမျိုးအစား",
      video: "ဗီဒီယို",
      picture: "ပုံ",
      link: "ဝက်ဘ်စာမျက်နှာ",
      where: "ပြမည့်နေရာ",
      timing: "ပေါ်ချိန်",
      movies: "ရုပ်ရှင်များ",
      when: "ပြမည့်အချိန်",
      more: "နောက်ထပ် ရွေးချယ်စရာများ",
      note: "ဝန်ထမ်းသာ မြင်ရသော မှတ်စု",
    },
    values: {
      picked: (fileName: string, detail: string) => `${fileName} · ${detail}`,
      videoLong: (length: string) => `${length} ကြာ`,
      currentVideo: "လက်ရှိ ဗီဒီယို",
      noVideo: "ဗီဒီယို မရှိသေးပါ",
      currentPicture: "လက်ရှိ ပုံ",
      noPicture: "ပုံ မရှိသေးပါ",
      noLink: "မရှိပါ — နှိပ်လျှင် ဘာမှ မဖြစ်ပါ",
      skipAfter: (n: number) => `${n} စက္ကန့် ကြာပြီးနောက် ကျော်နိုင်သည်`,
      noSkip: "ကျော်၍ မရပါ",
      stays: (n: string) => `${n} စက္ကန့် ပေါ်နေမည်`,
      staysUntilClosed: "ကြည့်သူ ပိတ်သည်အထိ ပေါ်နေမည်",
      comesBack: (n: string) => `ကြည့်ချိန် ${n} မိနစ်တိုင်း ပြန်ပေါ်မည်`,
      once: "တစ်ကြိမ်သာ ပေါ်မည်",
      closable: "ကြည့်သူများ ပိတ်နိုင်သည်",
      notClosable: "ပိတ်၍ မရပါ",
      chosenList: (count: number, names: string) => `${count} ကား ရွေးထားသည် — ${names}`,
      moreNames: (n: number) => `နောက်ထပ် ${n} ကား`,
      deletedMovie: "ဖျက်ထားသော ရုပ်ရှင်",
      listSeparator: "၊ ",
      fromNowNoEnd: "ယခုမှစ၍ · ပြီးမည့်ရက် မရှိ",
      fromNowUntil: (end: string) => `ယခုမှ ${end} အထိ`,
      fromNoEnd: (start: string) => `${start} မှစ၍ · ပြီးမည့်ရက် မရှိ`,
      fromUntil: (start: string, end: string) => `${start} မှ ${end} အထိ`,
      startedNoEnd: (start: string) => `${start} တွင် စခဲ့သည် · ပြီးမည့်ရက် မရှိ`,
      startedUntil: (start: string, end: string) => `${start} တွင် စခဲ့သည် · ${end} တွင် ပြီးမည်`,
      hours: (from: string, to: string) => `နေ့စဉ် ${from}–${to} အတွင်းသာ`,
      wait: (n: number) => `ကြည့်သူတစ်ဦး ထပ်မမြင်ရခင် ${n} မိနစ် စောင့်ရမည်`,
      perDay: {
        VIDEO: (n: number) => `ကြည့်သူတစ်ဦး တစ်ရက်လျှင် အများဆုံး ${n} ကြိမ်`,
        CORNER: (n: number) => `ကြည့်သူတစ်ဦး တစ်ရက်လျှင် ရုပ်ရှင် အများဆုံး ${n} ကား`,
      },
      priority: (n: number) => `အရင်ပြမည့် နံပါတ် — ${n}`,
      none: "မရှိပါ",
    },
    change: "ပြောင်းမည်",
    fix: "ပြင်မည်",
    dotLegend: "အနီစက်ပါသော အပိုင်းကို မသိမ်းမီ ပြင်ရပါမည်။",
    active: {
      label: "ယခုပဲ ဖွင့်မလား",
      yes: "ဖွင့်မည် — စပြပါ",
      yesDescription: "ကြည့်သူများ နောက်ထပ် ဖွင့်သော ရုပ်ရှင်မှစ၍ မြင်ရပါမည်။",
      yesNeedsVideo: "“ဗီဒီယို” အဆင့်တွင် ဗီဒီယို အရင်ထည့်ပါ။",
      yesNeedsPicture: "“ပုံ” အဆင့်တွင် ပုံ အရင်ထည့်ပါ။",
      no: "မဖွင့်သေးပါ — ပိတ်ထားလျက် သိမ်းမည်",
      noDescription: "စာရင်းတွင် သင် ဖွင့်သည်အထိ မည်သူမျှ မမြင်ရပါ။",
    },
    adsOffNote:
      "ယခု ကြော်ငြာ ဆက်တင်တွင် ကြော်ငြာအားလုံးကို ပိတ်ထားသဖြင့် ပြန်ဖွင့်သည်အထိ ကြည့်သူများ မမြင်ရပါ။",
  },
  issues: {
    TITLE_REQUIRED: "ကြော်ငြာ အမည် ထည့်ပါ။",
    TITLE_TOO_LONG: (max: number) => `ကြော်ငြာ အမည် ရှည်လွန်းသည် — အများဆုံး စာလုံး ${max} လုံး။`,
    DESCRIPTION_TOO_LONG: (max: number) => `မှတ်စု ရှည်လွန်းသည် — အများဆုံး စာလုံး ${max} လုံး။`,
    VIDEO_NOT_MP4: "MP4 ဗီဒီယိုဖိုင် ရွေးပါ။",
    VIDEO_TOO_LARGE: (max: string) => `ဗီဒီယိုသည် ${max} ထက် ကြီးပါသည်။ ဖိုင်အသေး ရွေးပါ။`,
    VIDEO_DURATION: (minSeconds: number, maxMinutes: number) =>
      `ဗီဒီယို ကြာချိန်သည် ${minSeconds} စက္ကန့်မှ ${maxMinutes} မိနစ် အတွင်း ဖြစ်ရပါမည်။`,
    TARGET_MOVIES_REQUIRED:
      "အနည်းဆုံး ရုပ်ရှင် တစ်ကား အမှန်ခြစ်ပါ — သို့မဟုတ် “ရုပ်ရှင်အားလုံးနှင့် ဇာတ်လမ်းတွဲ အပိုင်းအားလုံး” ကို ရွေးပါ။",
    TARGET_TOO_MANY: (max: number) => `ရုပ်ရှင် အများဆုံး ${max} ကားသာ ရွေးနိုင်ပါသည်။`,
    TARGET_DELETED: "ရွေးထားသော ရုပ်ရှင်တစ်ကားကို ဖျက်ထားပါပြီ။ မသိမ်းမီ (အနီရောင်ဖြင့် ပြထားသည်ကို) ဖယ်ရှားပါ။",
    WINDOW_INVALID: "ပြီးမည့်ရက်သည် စမည့်ရက်၏ နောက်တွင် ဖြစ်ရပါမည်။",
    DAILY_WINDOW_INCOMPLETE: "နေ့စဉ် အချိန် နှစ်ခုလုံး (မှ နှင့် အထိ) ဖြည့်ပါ။",
    DAILY_WINDOW_SAME: "နေ့စဉ် အချိန် နှစ်ခု မတူရပါ။",
    PRIORITY_RANGE: (min: number, max: number) =>
      `“ဘယ်ကြော်ငြာ အရင်ပြမလဲ” သည် ${min} မှ ${max} အတွင်း ကိန်းပြည့် ဖြစ်ရပါမည်။`,
    SKIP_AFTER_REQUIRED: "ကြည့်သူများ စက္ကန့် မည်မျှ ကြာပြီးနောက် ကျော်နိုင်မည်ကို ထည့်ပါ။",
    SKIP_AFTER_RANGE: (min: number, max: number) =>
      `ကျော်ချိန်သည် ${min} မှ ${max} စက္ကန့် အတွင်း ကိန်းပြည့် ဖြစ်ရပါမည်။`,
    SKIP_AFTER_TOO_LONG: (length: string) => `ကျော်ချိန်သည် ဗီဒီယို ကြာချိန် (${length}) ထက် တိုရပါမည်။`,
    FREQUENCY_RANGE: (min: number, max: number) => `စောင့်ချိန်သည် ${min} မှ ${max} မိနစ် အတွင်း ကိန်းပြည့် ဖြစ်ရပါမည်။`,
    MAX_PER_DAY_RANGE: (min: number, max: number) =>
      `တစ်ရက် ကန့်သတ်ချက်သည် ${min} မှ ${max} အတွင်း ကိန်းပြည့် ဖြစ်ရပါမည်။`,
    SLOTS_REQUIRED: "ပြမည့်နေရာ ရွေးပါ — ရုပ်ရှင် မစမီ၊ ကြားဖြတ်ကြော်ငြာ အချိန်တွင် သို့မဟုတ် နှစ်ခုလုံး။",
    VIDEO_REQUIRED: "ယခု ဖွင့်ရန် ဗီဒီယို ထည့်ပါ — သို့မဟုတ် “မဖွင့်သေးပါ — ပိတ်ထားလျက် သိမ်းမည်” ကို ရွေးပါ။",
    PICTURE_TYPE: "PNG, JPG, WebP သို့မဟုတ် GIF ပုံ ရွေးပါ။",
    PICTURE_TOO_LARGE: (max: string) => `ပုံသည် ${max} ထက် ကြီးပါသည်။ ဖိုင်အသေး ရွေးပါ။`,
    PICTURE_UNREADABLE: "ဤပုံကို ဖတ်၍ မရပါ။ အခြားဖိုင် ရွေးပါ။",
    PICTURE_SHAPE: (minSide: number, maxAspect: number) =>
      `ပုံ၏ အနားတိုင်းသည် အနည်းဆုံး ${minSide} pixel ရှိရမည် ဖြစ်ပြီး အရှည်ဘက်သည် အတိုဘက်၏ ${maxAspect} ဆထက် မပိုရပါ။`,
    LINK_TOO_LONG: (max: number) => `ဝက်ဘ်စာမျက်နှာ လိပ်စာ ရှည်လွန်းသည် — အများဆုံး စာလုံး ${max} လုံး။`,
    LINK_INVALID:
      "ဤဝက်ဘ်စာမျက်နှာ လိပ်စာ အလုပ်မလုပ်ပါ။ https:// သို့မဟုတ် http:// ဖြင့် စသော (https://example.com ကဲ့သို့) ဝက်ဘ်လိပ်စာ ဖြစ်ရမည်ဖြစ်ပြီး space မပါရပါ။",
    CORNER_SHOW_RANGE: (min: number, max: number) =>
      `ပေါ်နေမည့် စက္ကန့်သည် ${min} မှ ${max} အတွင်း ကိန်းပြည့် ဖြစ်ရပါမည်။`,
    CORNER_REPEAT_RANGE: (min: number, max: number) =>
      `ပြန်မပေါ်မီ မိနစ်သည် ${min} မှ ${max} အတွင်း ကိန်းပြည့် ဖြစ်ရပါမည်။`,
    CORNER_REPEAT_TOO_SHORT:
      "ပေါ်နေသည့် အချိန်ထက် နောက်ကျမှ ပြန်ပေါ်ရပါမည် — မိနစ် ပိုထည့်ပါ သို့မဟုတ် စက္ကန့် လျှော့ပါ။",
    PICTURE_REQUIRED: "ယခု ဖွင့်ရန် ပုံ ထည့်ပါ — သို့မဟုတ် “မဖွင့်သေးပါ — ပိတ်ထားလျက် သိမ်းမည်” ကို ရွေးပါ။",
    START_DATE_MISSING: "စမည့်ရက် ရွေးပါ — သို့မဟုတ် “ချက်ချင်း” ကို ရွေးပါ။",
    END_DATE_MISSING: "ပြီးမည့်ရက် ရွေးပါ — သို့မဟုတ် “မပြီးပါ” ကို ရွေးပါ။",
  },
  server: {
    skipTooLong: "ကျော်ချိန်သည် ဗီဒီယို ကြာချိန်ထက် တိုရပါမည်။",
    pictureRequired: "မဖွင့်မီ ပုံ အရင်ထည့်ပါ။",
  },
} satisfies typeof wizardEn;
