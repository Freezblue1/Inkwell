/**
 * Demo content: "The Salt Archive", a short sample novel with chapters,
 * characters, locations, plot threads and three weeks of writing history.
 * The project is flagged `isDemo` so it can be deleted in one click.
 */
import type { Character, ID, LocationEntry, ItemEntry, LoreNote } from '@/types/models';
import { BundleBuilder } from './builder';
import { importBundle } from './bundle';
import { makeGoal, makeProject } from '@/lib/defaults';
import { addDays, dayKey } from '@/lib/dates';

export async function createSampleProject(): Promise<ID> {
  const project = makeProject({ title: 'The Salt Archive', author: 'A. N. Example', kind: 'novel', isDemo: true });
  project.subtitle = 'A sample novel';
  const [mainLabel, subLabel, flashLabel] = project.labels;
  const b = new BundleBuilder(project);

  // --- Story bible -------------------------------------------------------
  const mara = b.addBible<Character>('character', {
    name: 'Mara Quill',
    role: 'Protagonist',
    age: '34',
    summary: 'Archivist of the drowned town of Greyhaven, who catalogues what the tide returns.',
    appearance: 'Ink-stained fingers, salt-whitened boots, a coat two sizes too big that belonged to her mother.',
    personality: 'Patient, exact, privately stubborn. Trusts paper more than people.',
    goals: 'Find the Brass Ledger and prove the town was sold, not lost.',
    flaws: 'Hoards the truth until it is perfectly documented — often too late.',
    arc: 'From keeper of records to someone willing to speak before she is certain.',
    color: '#3949ab',
  });
  const tobiah = b.addBible<Character>('character', {
    name: 'Tobiah Venn',
    role: 'Mentor',
    age: '71',
    summary: 'Last keeper of the Greyhaven light. Knows more about the flood than he admits.',
    appearance: 'Tall and stooped, beard like rope fibre, one milky eye.',
    personality: 'Gentle, evasive, fond of riddles and bad tea.',
    goals: 'Keep the light burning one more winter.',
    flaws: 'Guilt has made him a coward about the past.',
    arc: 'Confesses his part in the Tide Compact.',
    color: '#00897b',
  });
  const ines = b.addBible<Character>('character', {
    name: 'Ines Arroyo',
    role: 'Ally / love interest',
    age: '31',
    summary: 'A cartographer mapping the new coastline for the mainland survey.',
    appearance: 'Sun-browned, quick hands, a brass theodolite on her back.',
    personality: 'Bold, funny, restless; asks the questions Mara avoids.',
    goals: 'Finish the survey before the money runs out.',
    flaws: 'Leaves before things get difficult.',
    arc: 'Chooses to stay.',
    color: '#d81b60',
  });
  const sallow = b.addBible<Character>('character', {
    name: 'Edwin Sallow',
    role: 'Antagonist',
    age: '58',
    summary: 'Harbourmaster of the mainland port, who brokered the deal that drowned Greyhaven.',
    appearance: 'Immaculate grey suit, signet ring, smells of bay rum.',
    personality: 'Courteous, transactional, never raises his voice.',
    goals: 'Bury the ledger for good.',
    flaws: 'Believes everyone has a price.',
    arc: 'Exposed by his own records.',
    color: '#6d4c41',
  });
  mara.relationships = [
    { targetId: tobiah.id, type: 'Apprentice of' },
    { targetId: ines.id, type: 'Falling for' },
    { targetId: sallow.id, type: 'Investigating' },
  ];
  tobiah.relationships = [{ targetId: sallow.id, type: 'Owes a debt to' }];
  ines.relationships = [{ targetId: mara.id, type: 'Drawn to' }];

  const lighthouse = b.addBible<LocationEntry>('location', {
    name: 'Greyhaven Light',
    locationType: 'Lighthouse',
    summary: 'The only building of Greyhaven still above the waterline.',
    description: 'A white tower on a spur of rock, its lower rooms given over to Mara’s archive.',
    sensory: 'Paraffin, wet stone, the groan of the lamp turning.',
    significance: 'Home, workplace, and the last witness to the flood.',
  });
  const market = b.addBible<LocationEntry>('location', {
    name: 'The Drowned Market',
    locationType: 'Ruin',
    summary: 'The old market square, visible at the lowest tides.',
    description: 'Stalls and a clock tower beneath three fathoms of green water.',
    sensory: 'Kelp, rust, the muffled tolling of the clock at slack water.',
    significance: 'Where the ledger was last seen.',
  });
  const port = b.addBible<LocationEntry>('location', {
    name: 'Calder Port',
    locationType: 'Mainland town',
    summary: 'Prosperous harbour town that grew rich after the flood.',
    description: 'New granite quays, a customs house, Sallow’s office overlooking it all.',
    sensory: 'Coal smoke, gulls, money.',
    significance: 'Seat of the antagonist.',
  });
  const ledger = b.addBible<ItemEntry>('item', {
    name: 'The Brass Ledger',
    summary: 'A brass-bound account book recording the sale of Greyhaven’s sea wall.',
    description: 'Heavy, verdigris on the clasps, pages waxed against water.',
    origin: 'Kept by the town clerk until the night of the flood.',
    significance: 'Proof that the flood was arranged.',
  });
  b.addBible<LoreNote>('lore', {
    name: 'The Tide Compact',
    category: 'History',
    summary: 'The secret agreement to stop maintaining Greyhaven’s sea wall.',
    body: 'Signed by the harbourmaster and three town elders. In exchange for relocation money, they let the winter storms do the rest.',
    linkedIds: [ledger.id, sallow.id, tobiah.id],
  });

  // --- Manuscript --------------------------------------------------------
  b.add('frontmatter', 'Title Page', null, { paras: ['The Salt Archive', 'A. N. Example'] });
  b.add('frontmatter', 'Dedication', null, { paras: ['*For everyone who keeps the lists.*'] });

  // A special (unnumbered) chapter: compiled as "Prologue", chapter numbering starts after it.
  b.add('chapter', 'The Night of the Flood', null, {
    status: 'Revision',
    synopsis: 'Greyhaven drowns. Someone carries a brass-bound book up the clock tower.',
    metadata: { special: 'prologue', pov: null, timelineDate: '1885-01-14', timelineTime: '23:50' },
    paras: [
      'The sea came in the way a debt comes due: slowly, and then all at once.',
      'In the market square the water found the gutters first, then the doorsteps, then the clock tower’s lowest window. A man in a clerk’s coat climbed the tower stairs two at a time, holding a brass-bound book against his chest as if it were a child.',
      'Above him the clock struck eleven. It was nearly two.',
    ],
  });

  const part1 = b.add('part', 'Part One: Low Water', null, { status: 'Draft', synopsis: 'Mara discovers the ledger exists.' });

  const ch1 = b.add('chapter', 'The Tide Returns Things', part1, { status: 'Revision', target: 4000, synopsis: 'Mara’s routine; the first clue.' });
  const s1 = b.add('scene', 'Catalogue of the Drowned', ch1, {
    status: 'Revision',
    label: mainLabel.id,
    synopsis: 'Mara logs the morning’s salvage and finds a page torn from a ledger.',
    target: 1500,
    metadata: { pov: mara.id, locationId: lighthouse.id, timelineDate: '1891-10-02', timelineTime: '06:10', tags: ['opening', 'routine'] },
    paras: [
      'Every morning the tide returned something, and every morning Mara Quill wrote it down.',
      'Today it was a teapot with no lid, a child’s shoe, a brass doorknob green as a beetle, and a single sheet of paper folded so tightly that the sea had not managed to get inside it. She laid them in a row on the long table in the lamp room and reached for her pen.',
      '*Item 4,112. Teapot, earthenware, glaze crazed. Found at the foot of the north steps.*',
      'She had catalogued four thousand objects in six years. Spoons. Spectacles. The bell from the schoolhouse, which had taken two men and a winch. She did not catalogue the bodies; there had been none, and that was the first strange thing, though nobody but Mara seemed to think it strange.',
      'The folded paper resisted her. She warmed it by the lamp until the fibres loosened, then opened it the way her mother had taught her, corner by corner, breathing through her nose.',
      'It was a page torn from an account book. Columns of figures, a date three weeks before the flood, and a line of copperplate at the bottom that made her set the pen down very carefully.',
      '*Received of E. Sallow, in full settlement for the wall.*',
    ],
  });
  const s2 = b.add('scene', 'The Keeper’s Riddle', ch1, {
    status: 'Draft',
    label: mainLabel.id,
    synopsis: 'Tobiah deflects Mara’s questions about the page.',
    target: 1500,
    metadata: { pov: mara.id, locationId: lighthouse.id, timelineDate: '1891-10-02', timelineTime: '19:40', tags: ['mentor'] },
    paras: [
      'Tobiah Venn read the page twice, held it up to the lamp, and handed it back as if it were hot.',
      '“Where did the sea give you this?”',
      '“North steps. With a teapot.” Mara watched his good eye. “Who is E. Sallow?”',
      '“A harbourmaster.” He busied himself with the kettle. “Over at Calder. Fine house. Fine teeth.”',
      '“What wall did he pay for?”',
      'The kettle began to tick as it heated. Tobiah stared into it as though the answer were printed on the bottom. “What do you call a door that is never opened?” he said at last.',
      '“I’m not doing riddles tonight, Tobiah.”',
      '“A wall.” He poured, and the water missed the cup. “Go to bed, Mara. Some things are better drowned.”',
      '* * *',
      'She did not go to bed. She sat beneath the turning lamp with the page in her lap and listened to the clock in the drowned market toll the slack water — eleven strokes, though it was nearly two.',
    ],
  });

  const ch2 = b.add('chapter', 'The Surveyor', part1, { status: 'Draft', target: 4000, synopsis: 'Ines arrives; an alliance forms.' });
  const s3 = b.add('scene', 'A Stranger with a Theodolite', ch2, {
    status: 'Draft',
    label: subLabel.id,
    synopsis: 'Ines lands at the lighthouse asking for the old town maps.',
    target: 1500,
    metadata: { pov: mara.id, locationId: lighthouse.id, timelineDate: '1891-10-04', timelineTime: '11:00', tags: ['meet-cute'] },
    paras: [
      'The woman who climbed out of the rowing boat had a brass instrument strapped to her back like a second spine.',
      '“Ines Arroyo,” she called up the steps. “Mainland Survey. I’m told you have the only maps of Greyhaven that aren’t underwater.”',
      '“I have the only everything of Greyhaven that isn’t underwater,” Mara said, and was surprised to hear herself make a joke.',
      'Ines laughed — a real laugh, unpractised — and the sound went up the tower and came back down changed.',
      'The maps lived in a cedar chest that smelled of pencil shavings. Ines spread them across the floor, weighting the corners with Mara’s catalogued spoons, and crawled between them on her knees.',
      '“Your sea wall,” she said after a while, frowning. “On the 1880 survey it’s eight feet thick. On this one, a year before the flood, someone has written *repairs deferred* across the whole length of it.”',
      'Mara knelt beside her. The handwriting was the same copperplate as the torn page.',
    ],
  });
  const s4 = b.add('scene', 'Low Tide at the Market', ch2, {
    status: 'Outline',
    label: mainLabel.id,
    synopsis: 'Mara and Ines row out at the lowest tide of the year to search the clock tower.',
    target: 1800,
    metadata: { pov: ines.id, locationId: market.id, timelineDate: '1891-10-09', timelineTime: '04:30', tags: ['set piece'] },
    paras: [
      'The lowest tide of the year came before dawn, and it pulled the sea back so far that the roof of the clock tower broke the surface like the back of a whale.',
      'Ines held the lantern. Mara held the boat steady against the stonework, her breath fogging, her hands numb inside two pairs of gloves.',
      '“If the clerk kept his books anywhere,” Mara said, “it was in the tower. He wound the clock himself. He didn’t trust anyone else with the key.”',
    ],
  });

  const part2 = b.add('part', 'Part Two: High Water', null, { status: 'Outline', synopsis: 'The truth surfaces.' });
  const ch3 = b.add('chapter', 'Calder', part2, { status: 'Outline', target: 4000, synopsis: 'Mara confronts Sallow on his own ground.' });
  const s5 = b.add('scene', 'The Harbourmaster’s Office', ch3, {
    status: 'Idea',
    label: mainLabel.id,
    synopsis: 'Sallow offers Mara a position — and a price.',
    target: 2000,
    metadata: { pov: mara.id, locationId: port.id, timelineDate: '1891-10-15', timelineTime: '15:00', tags: ['confrontation'] },
    paras: ['Sallow’s office smelled of bay rum and beeswax, and every surface that could be polished had been.'],
  });
  const s6 = b.add('scene', 'What Tobiah Signed', ch3, {
    status: 'Idea',
    label: flashLabel.id,
    synopsis: 'Flashback: the night of the Tide Compact.',
    target: 1500,
    metadata: { pov: tobiah.id, locationId: lighthouse.id, timelineDate: '1885-01-12', timelineTime: '22:00', tags: ['flashback'] },
    paras: [''],
  });

  b.add('backmatter', 'Acknowledgements', null, { paras: ['Thanks to the archivists, who keep everything.'] });
  b.add('note', 'Themes', null, {
    paras: ['Records versus memory. What a community owes the drowned. Paper as a form of love.'],
  });
  b.add('note', 'Open questions', null, {
    paras: ['Why does the clock toll the wrong hour?', 'Does Ines leave at the end of Part Two?'],
  });

  // --- Plot grid ----------------------------------------------------------
  b.addThread('The missing ledger', '#3949ab', {
    [s1.id]: 'Torn page found',
    [s3.id]: '“Repairs deferred”',
    [s4.id]: 'Search the clock tower',
    [s5.id]: 'Sallow wants it back',
  });
  b.addThread('Mara & Ines', '#d81b60', { [s3.id]: 'First meeting', [s4.id]: 'Trust in the dark' });
  b.addThread('Tobiah’s secret', '#00897b', { [s2.id]: 'The riddle', [s6.id]: 'The signing' });

  // Link scenes to characters manually (the plot grid "Characters" mode uses these).
  s1.metadata.linkedIds = [mara.id, ledger.id];
  s2.metadata.linkedIds = [mara.id, tobiah.id, sallow.id];
  s3.metadata.linkedIds = [mara.id, ines.id];
  s4.metadata.linkedIds = [mara.id, ines.id, market.id];
  s5.metadata.linkedIds = [mara.id, sallow.id];
  s6.metadata.linkedIds = [tobiah.id, sallow.id];

  // --- Goals & writing history --------------------------------------------
  const deadline = dayKey(addDays(new Date(), 120));
  b.goal = makeGoal(project.id, 80000, deadline);
  const pattern = [420, 0, 610, 880, 300, 0, 0, 1250, 540, 760, 0, 390, 1020, 0, 0, 640, 910, 480, 0, 700, 350];
  pattern.forEach((net, i) => {
    const date = dayKey(addDays(new Date(), -pattern.length + i));
    b.sessions.push({
      id: `${project.id}:${date}`,
      projectId: project.id,
      date,
      added: net + Math.round(net * 0.15),
      removed: Math.round(net * 0.15),
      net,
      sprints: net > 800 ? 2 : net > 0 ? 1 : 0,
      updatedAt: Date.now(),
    });
  });

  return importBundle(b.toBundle(), { keepIds: true });
}
