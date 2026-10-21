# Say it in Iraq

The second Malwiya opening links to `/say-it/`. Its return link goes to
`/#say-it`. Reduced-motion visitors get direct links to both features.

Six categories contain four expressions each, including taxi rides. The selected phrase shows
Arabic, an everyday English meaning and a single sentence about the moment.
There is no transliteration, lesson system, microphone access or runtime AI dependency.

## Recordings

The original twenty clips use the supplied human recording in
`public/audio/normal expressions/`. It was split in the exact 20-phrase order
below, trimmed at the pauses, and normalized for consistent playback. The four
taxi clips use the ar-IQ-RanaNeural synthetic voice generated with the existing
script. Their generation manifest is bundled beside the clips; pronunciation
review by a native Iraqi speaker remains recommended.

Link directly to the taxi category with `/say-it/#taxi`. Visitors can copy the
Arabic phrase and continue to Daleel taxi services or return to their trip.

Generate missing files with:
`node --experimental-strip-types scripts/generate-expression-audio.mjs`.
The script uses `../.audio-tools/Scripts/python.exe` by default; override with
`BILAD_TTS_PYTHON` if needed. Install `edge-tts==7.3.1` in that Python environment.
Visitors play the bundled MP3 files without connecting to a speech provider.
The generated clips remain replaceable if a future phrase needs a fallback.
The page resolves available MP3 files during static generation. Missing
recordings have a disabled, labelled control. Playback is exclusive, stops
when choosing another expression/category, leaving the page or hiding the
tab, and reports failed playback with a retry action.

| File | Arabic to record | Intended meaning |
| --- | --- | --- |
| hala.mp3 | هلا | Hello! |
| ahlan-wa-sahlan.mp3 | أهلاً وسهلاً | Welcome! |
| sabah-al-khair.mp3 | صباح الخير | Good morning |
| shlonkum.mp3 | شلونكم؟ | How are you all? |
| chai.mp3 | ممكن چاي؟ | Could I have some tea? |
| tayyib.mp3 | كلش طيب | It’s delicious! |
| tislam-al-ayadi.mp3 | تسلم الأيادي | Thank you for the lovely food |
| bil-afiya.mp3 | بالعافية | Enjoy your meal |
| shgad.mp3 | بشكد هذا؟ | How much is this? |
| mumkin-ashuf.mp3 | ممكن أشوف؟ | May I take a look? |
| akhudha.mp3 | آخذه | I’ll take it |
| la-shukran.mp3 | لا، شكراً | No, thank you |
| taxi-take-me.mp3 | ممكن توصلني لهذا المكان؟ | Can you take me to this place? |
| taxi-fare.mp3 | بشكد التوصيلة؟ | How much is the fare? |
| taxi-stop-here.mp3 | هنا زين، بلا زحمة | Here is fine, please |
| taxi-wait.mp3 | ممكن تنتظرني شويّة؟ | Could you wait for me a little? |
| shukran.mp3 | شكراً | Thank you |
| bila-zahma.mp3 | بلا زحمة | If you don’t mind |
| warda.mp3 | وردة | You’re lovely |
| kullish-helu.mp3 | كلش حلو | So beautiful! |
| ma-al-salama.mp3 | مع السلامة | Goodbye |
| ashufkum.mp3 | أشوفكم على خير | See you again |
| fursa-saeeda.mp3 | فرصة سعيدة | Lovely to meet you |
| yawm-saeed.mp3 | يوم سعيد | Have a lovely day |

## Editorial scope

This MVP mixes everyday Iraqi forms with familiar shared Arabic expressions.
It does not claim a regional dialect survey or that every phrase is uniquely
Iraqi. English copy conveys the intended meaning rather than literal wording.
The brief notes distinguish greetings to groups and a familiar compliment.
Final native-speaker review should happen alongside recording.

Reference checks: [Iraqi phrase library](https://www.learnlahjaapp.com/iraqi/library/),
[Iraqi Arabic phrasebook](https://www.qvyshift.com/phrasebook/iraqi-arabic/),
and [community examples of Iraqi courtesy expressions](https://www.reddit.com/r/Iraq/comments/1eytzpp).
These are supporting references, not verification of all twenty recordings
or a substitute for the speaker's review.
