export const expressionCategories = [
  { id: 'hello', label: 'Say hello', invitation: 'A little word. A warmer welcome.' },
  { id: 'table', label: 'At the table', invitation: 'Good food brings people together.' },
  { id: 'market', label: 'At the market', invitation: 'A small exchange, a shared smile.' },
  { id: 'taxi', label: 'In a taxi', invitation: 'A few words to help you on your way.' },
  { id: 'kindness', label: 'Be kind', invitation: 'Leave a little warmth behind.' },
  { id: 'goodbye', label: 'Until next time', invitation: 'Every meeting has a lovely ending.' },
] as const;

export type ExpressionCategory = typeof expressionCategories[number]['id'];
export type Expression = { id: string; category: ExpressionCategory; arabic: string; meaning: string; moment: string };

// Everyday Iraqi Arabic, with shared Arabic expressions where they fit naturally.
// IDs also name the audio files in public/audio/expressions/.
export const expressions: Expression[] = [
  { id: 'hala', category: 'hello', arabic: 'هلا', meaning: 'Hello!', moment: 'A friendly way to start a conversation.' },
  { id: 'ahlan-wa-sahlan', category: 'hello', arabic: 'أهلاً وسهلاً', meaning: 'Welcome!', moment: 'Make someone feel at home.' },
  { id: 'sabah-al-khair', category: 'hello', arabic: 'صباح الخير', meaning: 'Good morning', moment: 'Start the day with a smile.' },
  { id: 'shlonkum', category: 'hello', arabic: 'شلونكم؟', meaning: 'How are you all?', moment: 'When greeting a group of people.' },
  { id: 'chai', category: 'table', arabic: 'ممكن چاي؟', meaning: 'Could I have some tea?', moment: 'For a little pause over a glass of tea.' },
  { id: 'tayyib', category: 'table', arabic: 'كلش طيب', meaning: 'It’s delicious!', moment: 'When the food deserves a compliment.' },
  { id: 'tislam-al-ayadi', category: 'table', arabic: 'تسلم الأيادي', meaning: 'Thank you for the lovely food', moment: 'A warm compliment to whoever cooked.' },
  { id: 'bil-afiya', category: 'table', arabic: 'بالعافية', meaning: 'Enjoy your meal', moment: 'Say it to someone enjoying their food.' },
  { id: 'shgad', category: 'market', arabic: 'بشكد هذا؟', meaning: 'How much is this?', moment: 'When something catches your eye.' },
  { id: 'mumkin-ashuf', category: 'market', arabic: 'ممكن أشوف؟', meaning: 'May I take a look?', moment: 'Ask to see something a little closer.' },
  { id: 'akhudha', category: 'market', arabic: 'آخذه', meaning: 'I’ll take it', moment: 'When you’ve found the one you like.' },
  { id: 'la-shukran', category: 'market', arabic: 'لا، شكراً', meaning: 'No, thank you', moment: 'A simple, polite way to decline.' },
  { id: 'taxi-take-me', category: 'taxi', arabic: 'ممكن توصلني لهذا المكان؟', meaning: 'Can you take me to this place?', moment: 'Show the driver your destination on the map.' },
  { id: 'taxi-fare', category: 'taxi', arabic: 'بشكد التوصيلة؟', meaning: 'How much is the fare?', moment: 'Ask about the price before starting the ride.' },
  { id: 'taxi-stop-here', category: 'taxi', arabic: 'هنا زين، بلا زحمة', meaning: 'Here is fine, please', moment: 'Let the driver know where you would like to get out.' },
  { id: 'taxi-wait', category: 'taxi', arabic: 'ممكن تنتظرني شويّة؟', meaning: 'Could you wait for me a little?', moment: 'Ask the driver to wait briefly at a stop.' },
  { id: 'shukran', category: 'kindness', arabic: 'شكراً', meaning: 'Thank you', moment: 'For the small kindnesses along the way.' },
  { id: 'bila-zahma', category: 'kindness', arabic: 'بلا زحمة', meaning: 'If you don’t mind', moment: 'A gentle way to ask for a small favour.' },
  { id: 'warda', category: 'kindness', arabic: 'وردة', meaning: 'You’re lovely', moment: 'A playful, friendly compliment to someone you’ve warmed to.' },
  { id: 'kullish-helu', category: 'kindness', arabic: 'كلش حلو', meaning: 'So beautiful!', moment: 'For a place, a view, or something you love.' },
  { id: 'ma-al-salama', category: 'goodbye', arabic: 'مع السلامة', meaning: 'Goodbye', moment: 'A warm farewell as you leave.' },
  { id: 'ashufkum', category: 'goodbye', arabic: 'أشوفكم على خير', meaning: 'See you again', moment: 'When saying goodbye to a group.' },
  { id: 'fursa-saeeda', category: 'goodbye', arabic: 'فرصة سعيدة', meaning: 'Lovely to meet you', moment: 'After meeting someone new.' },
  { id: 'yawm-saeed', category: 'goodbye', arabic: 'يوم سعيد', meaning: 'Have a lovely day', moment: 'Leave someone with a good wish.' },
];
