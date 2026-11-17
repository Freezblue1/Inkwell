/** Word lists used by writing analysis and proofreading. */

export const STOPWORDS = new Set(
  `a about above after again against all am an and any are as at be because been before being below between both but by
  can could did do does doing down during each few for from further had has have having he her here hers herself him
  himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other
  our ours ourselves out over own same she should so some such than that the their theirs them themselves then there
  these they this those through to too under until up very was we were what when where which while who whom why will
  with would you your yours yourself yourselves said says say one two also back like into it's i'm don't didn't can't
  won't i'd i'll you're he's she's that's there's they're we're wasn't weren't isn't aren't hadn't hasn't haven't let
  get got go went come came know knew see saw look looked make made take took thing things way well even still yet
  much many may might must shall upon around`
    .split(/\s+/)
    .filter(Boolean),
);

/** Filler and hedge words that usually weaken prose. */
export const FILLER_WORDS = [
  'just',
  'really',
  'very',
  'quite',
  'rather',
  'somewhat',
  'somehow',
  'actually',
  'basically',
  'literally',
  'simply',
  'totally',
  'completely',
  'absolutely',
  'definitely',
  'certainly',
  'probably',
  'perhaps',
  'maybe',
  'seemed',
  'seems',
  'started to',
  'began to',
  'suddenly',
  'that',
  'kind of',
  'sort of',
  'a bit',
  'a little',
  'in order to',
];

/** -ly words that are not adverbs. */
export const NON_ADVERB_LY = new Set(
  `family fly only early belly holy ugly jelly rally reply supply apply ally bully lily daily silly hilly folly jolly
  melancholy assembly anomaly italy july monopoly butterfly dragonfly firefly friendly lovely lonely lively likely
  costly deadly elderly kindly lowly orderly sly wily curly burly surly comely homely ghostly heavenly unlikely ply
  multiply comply imply rely wobbly gnarly smelly woolly chilly frilly bubbly crumbly prickly grisly gully sully tally
  dally emily molly polly kelly sally billy filly`
    .split(/\s+/)
    .filter(Boolean),
);

export function isAdverb(word: string): boolean {
  const w = word.toLowerCase();
  return w.length > 4 && w.endsWith('ly') && !NON_ADVERB_LY.has(w);
}

/** Common misspellings → correction (offline proofreading). */
export const MISSPELLINGS: Record<string, string> = {
  teh: 'the',
  recieve: 'receive',
  recieved: 'received',
  beleive: 'believe',
  belive: 'believe',
  definately: 'definitely',
  seperate: 'separate',
  occured: 'occurred',
  occurence: 'occurrence',
  untill: 'until',
  wich: 'which',
  thier: 'their',
  freind: 'friend',
  wierd: 'weird',
  acheive: 'achieve',
  accomodate: 'accommodate',
  adress: 'address',
  alot: 'a lot',
  arguement: 'argument',
  begining: 'beginning',
  calender: 'calendar',
  cemetary: 'cemetery',
  concious: 'conscious',
  embarass: 'embarrass',
  enviroment: 'environment',
  existance: 'existence',
  foriegn: 'foreign',
  goverment: 'government',
  happend: 'happened',
  immediatly: 'immediately',
  independant: 'independent',
  knowlege: 'knowledge',
  liason: 'liaison',
  libary: 'library',
  lightening: 'lightning',
  millenium: 'millennium',
  neccessary: 'necessary',
  noticable: 'noticeable',
  persistant: 'persistent',
  posession: 'possession',
  prefered: 'preferred',
  publically: 'publicly',
  realy: 'really',
  rythm: 'rhythm',
  sieze: 'seize',
  succesful: 'successful',
  suprise: 'surprise',
  tommorow: 'tomorrow',
  tounge: 'tongue',
  truely: 'truly',
  unforseen: 'unforeseen',
  vaccuum: 'vacuum',
  whereever: 'wherever',
  writting: 'writing',
  youre: "you're",
  dont: "don't",
  doesnt: "doesn't",
  didnt: "didn't",
  cant: "can't",
  wont: "won't",
  im: "I'm",
  ive: "I've",
  couldnt: "couldn't",
  shouldnt: "shouldn't",
  wouldnt: "wouldn't",
  isnt: "isn't",
  wasnt: "wasn't",
  hte: 'the',
  adn: 'and',
  taht: 'that',
  waht: 'what',
  becuase: 'because',
  becasue: 'because',
  infront: 'in front',
  aswell: 'as well',
  everytime: 'every time',
  alright: 'all right',
  grammer: 'grammar',
  pronounciation: 'pronunciation',
  publicaly: 'publicly',
  threshhold: 'threshold',
};
