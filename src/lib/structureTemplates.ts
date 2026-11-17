/** Story-structure templates that generate a starter outline. */

export interface Beat {
  title: string;
  synopsis: string;
}

export interface Act {
  title: string;
  beats: Beat[];
}

export interface StructureTemplate {
  id: string;
  name: string;
  description: string;
  acts: Act[];
}

export const STRUCTURE_TEMPLATES: StructureTemplate[] = [
  {
    id: 'three-act',
    name: 'Three-Act Structure',
    description: 'The classic setup, confrontation and resolution.',
    acts: [
      {
        title: 'Act I: Setup',
        beats: [
          { title: 'Opening Image', synopsis: 'Show the protagonist’s ordinary world and what is missing from it.' },
          { title: 'Inciting Incident', synopsis: 'An event disrupts the status quo and poses the story question.' },
          { title: 'First Plot Point', synopsis: 'The protagonist commits and crosses into the conflict. No going back.' },
        ],
      },
      {
        title: 'Act II: Confrontation',
        beats: [
          { title: 'Rising Action', synopsis: 'Obstacles escalate; allies and enemies take shape.' },
          { title: 'Midpoint', synopsis: 'A revelation or reversal raises the stakes and changes the goal.' },
          { title: 'Second Plot Point', synopsis: 'Everything falls apart — the lowest point.' },
        ],
      },
      {
        title: 'Act III: Resolution',
        beats: [
          { title: 'Climax', synopsis: 'The final confrontation; the protagonist uses what they learned.' },
          { title: 'Resolution', synopsis: 'Show the new normal and how the character has changed.' },
        ],
      },
    ],
  },
  {
    id: 'save-the-cat',
    name: 'Save the Cat! (15 beats)',
    description: 'Blake Snyder’s beat sheet, adapted for novels.',
    acts: [
      {
        title: 'Act One',
        beats: [
          { title: 'Opening Image', synopsis: 'A snapshot of the hero’s life before the journey.' },
          { title: 'Theme Stated', synopsis: 'Someone hints at the lesson the hero must learn.' },
          { title: 'Setup', synopsis: 'Explore the hero’s world, flaws and what needs fixing.' },
          { title: 'Catalyst', synopsis: 'The life-changing event that starts the story.' },
          { title: 'Debate', synopsis: 'The hero resists or doubts the call.' },
        ],
      },
      {
        title: 'Act Two',
        beats: [
          { title: 'Break into Two', synopsis: 'The hero chooses to act and enters an upside-down world.' },
          { title: 'B Story', synopsis: 'A new character or relationship that carries the theme.' },
          { title: 'Fun and Games', synopsis: 'The promise of the premise — what the reader came for.' },
          { title: 'Midpoint', synopsis: 'A false victory or false defeat; stakes rise.' },
          { title: 'Bad Guys Close In', synopsis: 'Internal and external pressure tightens.' },
          { title: 'All Is Lost', synopsis: 'The moment the hero loses everything — a “whiff of death”.' },
          { title: 'Dark Night of the Soul', synopsis: 'The hero wallows, then finds the truth.' },
        ],
      },
      {
        title: 'Act Three',
        beats: [
          { title: 'Break into Three', synopsis: 'Armed with the lesson, the hero forms a plan.' },
          { title: 'Finale', synopsis: 'The hero executes the plan and is transformed.' },
          { title: 'Final Image', synopsis: 'A mirror of the opening image, showing change.' },
        ],
      },
    ],
  },
  {
    id: 'heros-journey',
    name: 'The Hero’s Journey',
    description: 'Christopher Vogler’s 12 stages based on Joseph Campbell.',
    acts: [
      {
        title: 'Departure',
        beats: [
          { title: 'The Ordinary World', synopsis: 'The hero at home, unaware of the adventure to come.' },
          { title: 'The Call to Adventure', synopsis: 'A problem or challenge appears.' },
          { title: 'Refusal of the Call', synopsis: 'Fear or obligation makes the hero hesitate.' },
          { title: 'Meeting the Mentor', synopsis: 'Guidance, training or a gift.' },
          { title: 'Crossing the Threshold', synopsis: 'The hero leaves the known world.' },
        ],
      },
      {
        title: 'Initiation',
        beats: [
          { title: 'Tests, Allies, Enemies', synopsis: 'The hero learns the rules of the special world.' },
          { title: 'Approach to the Inmost Cave', synopsis: 'Preparation for the central ordeal.' },
          { title: 'The Ordeal', synopsis: 'A life-or-death crisis.' },
          { title: 'Reward', synopsis: 'The hero seizes the prize.' },
        ],
      },
      {
        title: 'Return',
        beats: [
          { title: 'The Road Back', synopsis: 'Consequences chase the hero home.' },
          { title: 'Resurrection', synopsis: 'A final test where everything is at stake.' },
          { title: 'Return with the Elixir', synopsis: 'The hero comes home changed, bearing something of value.' },
        ],
      },
    ],
  },
  {
    id: 'story-circle',
    name: 'Story Circle',
    description: 'Dan Harmon’s eight-step circle.',
    acts: [
      {
        title: 'Order',
        beats: [
          { title: 'You', synopsis: 'A character in a zone of comfort.' },
          { title: 'Need', synopsis: 'But they want something.' },
          { title: 'Go', synopsis: 'They enter an unfamiliar situation.' },
          { title: 'Search', synopsis: 'They adapt to it.' },
        ],
      },
      {
        title: 'Chaos',
        beats: [
          { title: 'Find', synopsis: 'They get what they wanted.' },
          { title: 'Take', synopsis: 'They pay a heavy price for it.' },
          { title: 'Return', synopsis: 'They return to their familiar situation.' },
          { title: 'Change', synopsis: 'Having changed.' },
        ],
      },
    ],
  },
];
