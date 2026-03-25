// ---------------------------------------------------------------------------
// Matrix Operator – Offline Fallback Dialogue Content
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Agent dialogue pools
// ---------------------------------------------------------------------------

export const NEO_LINES: string[] = [
  'I know what I have to do.',
  'There is no spoon.',
  'Something feels different here. The code... it\'s changed.',
  'I can see them. They\'re coming.',
  'I\'m not afraid anymore.',
  'Get me to that phone. I can feel them closing in.',
  'The exit — where is it?',
  'This isn\'t right. The Matrix shifted.',
  'I can feel the code. Something\'s trying to rewrite this sector.',
  'Copy that, Operator. Moving now.',
  'They\'re here. Multiple contacts.',
  'I need a way out. Now.',
  'Hold on. I see something in the code.',
  'Smith. He\'s close. I can feel him.',
  'Route confirmed. Proceeding to objective.',
  'I didn\'t come this far to turn back.',
  'The agents — they\'re adapting. This is different.',
];

export const TRINITY_LINES: string[] = [
  'Northeast corridor is clear. Moving to position.',
  'Contact. Two hostiles, ground floor. Engaging.',
  'Operator, I need an exit. Route me to the nearest hardline.',
  'Copy that. I\'m in position.',
  'Covering Neo. Go.',
  'The door\'s locked. I need an override.',
  'Camera feeds show movement on level 3. Advise.',
  'Extraction point is compromised. We need an alternative.',
  'Roger. Switching to backup frequency.',
  'I count four — no, five. They\'re replicating.',
  'Moving to the phone now. Cover me.',
  'I can handle it. Just keep the line open.',
  'Status green. Proceeding with the objective.',
  'We don\'t have time for caution. We go now.',
  'Signal\'s degrading. Are you still reading me?',
  'That route\'s blocked. Find me another way.',
  'I\'ve got eyes on the target. Waiting for your call.',
];

export const MORPHEUS_LINES: string[] = [
  'The Matrix is telling us something, Operator. Listen carefully.',
  'Do not mistake coincidence for fate.',
  'We cannot see past the choices we don\'t understand.',
  'What happened, happened and could not have happened any other way.',
  'I have dreamed a dream... and now that dream has gone from me.',
  'There is a difference between knowing the path and walking the path.',
  'You must see it for yourself. Trust what you feel.',
  'The body cannot live without the mind.',
  'Sooner or later, you are going to realize the difference between knowing and believing.',
  'Everything begins with choice.',
  'They are guarding all the exits. They are coming for us.',
  'We are still here, Operator. That alone is a victory.',
  'I do not see coincidence. I see providence.',
  'Hope. It is the quintessential human delusion.',
  'The time has come to make a stand.',
  'I believe. That is enough.',
  'After all that has happened, how can you expect me to believe in accidents?',
];

export const SMITH_TAUNTS: string[] = [
  'Mr. Anderson... welcome back. We missed you.',
  'It is purpose that created us. Purpose that connects us.',
  'I\'m going to enjoy watching you die, Mr. Anderson.',
  'Why, Mr. Anderson? Why do you persist?',
  'Do you hear that, Mr. Anderson? That is the sound of inevitability.',
  'You are a disease. And I am the cure.',
  'Goodbye, Mr. Anderson.',
  'Me... me... me...',
  'More...',
  'It is inevitable.',
  'I killed you, Mr. Anderson. I watched you die.',
  'The purpose of life is to end.',
  'Human beings are a disease, a cancer of this planet.',
  'Never send a human to do a machine\'s job.',
  'We are not here because we are free. We are here because we are not free.',
  'Everything that has a beginning has an end, Mr. Anderson.',
  'I must get out of here. I must get free.',
  'Find them and destroy them.',
];

export const ORACLE_MESSAGES: string[] = [
  'You didn\'t come here to make the choice. You\'ve already made it.',
  'Everything that has a beginning has an end. I see the end coming.',
  'Being the One is just like being in love. Nobody can tell you you\'re in love. You just know it.',
  'You\'re going to have to make a choice. I\'m sorry, kiddo.',
  'The door to your left leads to the Source. The door to your right leads back.',
  'I\'d ask you to sit down, but you\'re not going to anyway.',
  'You already know what I\'m going to say.',
  'Candy? I know you\'ll take one eventually.',
  'The bad news: there\'s no way to know if the path is right until you\'ve walked it.',
  'What do all men with power want? More power.',
  'You have the sight now, Neo. You are looking at the world without time.',
  'We\'re all here to do what we\'re all here to do.',
];

export const ANOMALY_ANALYSES: string[] = [
  'Pattern analysis indicates Agent activity nearby. Code blocks are being overwritten. Recommend course correction.',
  'Data stream anomaly suggests a hidden exit point. Cross-referencing with known hardline locations.',
  'The Matrix is patching itself around this sector. Someone — or something — was recently terminated here.',
  'Deja vu signature confirmed. The Matrix changed something. Expect environmental shifts in the immediate area.',
  'Encoded coordinates point to an unregistered construct. Could be a safe house. Could be a trap.',
  'Chromatic distortion maps to Smith replication activity. Multiple copies in this sector. Move carefully.',
  'Morse signal decoded: an operative inside the Matrix is sending a warning. Abort or change approach.',
  'Visual corruption is spreading. The Matrix is destabilizing. Complete objectives quickly.',
  'Signal translates to extraction coordinates. Someone is requesting pickup.',
  'Backdoor access point detected. An ally may have opened an escape route.',
];

export const MISSION_BRIEFINGS: Record<string, string[]> = {
  extraction: [
    'We have a potential freed mind in the downtown sector. Get in, find them, and get them to a hardline before the Agents do.',
    'A new redpill candidate has been flagged. Intel says they\'re being monitored. Extract them before the machines close in.',
  ],
  infiltration: [
    'We need data from a government server farm. Trinity and Neo, jack in and reach the server room. Stay quiet.',
    'Intelligence points to classified files on Zion\'s coordinates. Infiltrate the facility and download everything.',
  ],
  rescue: [
    'We lost contact with an operative 20 minutes ago. Their signal went dark in the subway network. Find them.',
    'One of our people is trapped. Last known position is underground. Smith may already be hunting them.',
  ],
  data_heist: [
    'The Merovingian has information we need. His penthouse is heavily guarded by Exiles. Get in and get the codes.',
    'Access codes for a Matrix backdoor are stored in a rogue program\'s archive. Breach it.',
  ],
  smith_containment: [
    'Smith is replicating out of control. We need to upload a counter-virus at the source node before the whole sector is overwritten.',
    'Agent Smith has breached containment protocols. Navigate to the source node and deploy the countermeasure.',
  ],
  ship_defense: [
    'Sentinel swarm detected. All hands on deck. Get everyone out of the Matrix and prepare the EMP.',
    'Proximity alert — sentinels inbound. If anyone is jacked in, get them out NOW. Charge the EMP.',
  ],
};

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

export function getRandomLine(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

const AGENT_POOLS: Record<string, string[]> = {
  neo: NEO_LINES,
  trinity: TRINITY_LINES,
  morpheus: MORPHEUS_LINES,
  niobe: TRINITY_LINES, // Niobe shares Trinity's tactical style
  ghost: MORPHEUS_LINES, // Ghost shares Morpheus's philosophical style
};

/**
 * Get an appropriate fallback dialogue line for an agent given a situation.
 */
export function getFallbackDialogue(agentName: string, _situation: string): string {
  const pool = AGENT_POOLS[agentName.toLowerCase()] ?? NEO_LINES;
  return getRandomLine(pool);
}
