// /ui/src/lib/server/duplicates/nicknames.ts
// Nickname matching for duplicate detection

/**
 * Common nickname mappings (formal name -> nicknames)
 * Bidirectional lookups supported
 */
const NICKNAME_MAP: Record<string, string[]> = {
  // Male names
  alexander: ['alex', 'al', 'xander', 'lex', 'sasha'],
  andrew: ['andy', 'drew'],
  anthony: ['tony', 'ant'],
  benjamin: ['ben', 'benji', 'benny'],
  charles: ['charlie', 'chuck', 'chas'],
  christopher: ['chris', 'topher', 'kit'],
  daniel: ['dan', 'danny'],
  david: ['dave', 'davey'],
  edward: ['ed', 'eddie', 'ted', 'teddy', 'ned'],
  eugene: ['gene'],
  frederick: ['fred', 'freddy', 'rick', 'fritz'],
  gregory: ['greg'],
  harold: ['harry', 'hal'],
  henry: ['hank', 'harry', 'hal'],
  jacob: ['jake', 'jack'],
  james: ['jim', 'jimmy', 'jamie', 'jem'],
  jason: ['jay'],
  jeffrey: ['jeff'],
  jerome: ['jerry'],
  john: ['jack', 'johnny', 'jon'],
  jonathan: ['jon', 'johnny', 'nathan'],
  joseph: ['joe', 'joey'],
  joshua: ['josh'],
  lawrence: ['larry', 'lars'],
  leonard: ['leo', 'lenny'],
  matthew: ['matt', 'matty'],
  michael: ['mike', 'mikey', 'mick'],
  nathaniel: ['nate', 'nathan', 'nat'],
  nicholas: ['nick', 'nicky'],
  patrick: ['pat', 'paddy'],
  peter: ['pete'],
  philip: ['phil'],
  raymond: ['ray'],
  richard: ['rick', 'ricky', 'dick', 'rich'],
  robert: ['rob', 'robbie', 'bob', 'bobby', 'bert'],
  ronald: ['ron', 'ronnie'],
  samuel: ['sam', 'sammy'],
  stephen: ['steve', 'stevie'],
  steven: ['steve', 'stevie'],
  theodore: ['ted', 'teddy', 'theo'],
  thomas: ['tom', 'tommy'],
  timothy: ['tim', 'timmy'],
  walter: ['walt', 'wally'],
  william: ['will', 'willy', 'bill', 'billy', 'liam'],
  zachary: ['zach', 'zack'],

  // Female names
  abigail: ['abby', 'gail'],
  alexandra: ['alex', 'lexi', 'sandra', 'sasha'],
  allison: ['ally', 'ali'],
  amanda: ['mandy', 'amy'],
  anastasia: ['ana', 'stacy'],
  angela: ['angie'],
  ann: ['annie', 'anna', 'nan', 'nancy'],
  barbara: ['barb', 'barbie', 'babs'],
  beatrice: ['bea', 'trixie'],
  bridget: ['bridie', 'biddy'],
  caroline: ['carol', 'carrie'],
  catherine: ['cathy', 'kate', 'katie', 'cat', 'kit', 'kitty'],
  charlotte: ['charlie', 'lottie'],
  christina: ['chris', 'chrissy', 'tina'],
  christine: ['chris', 'chrissy', 'tina'],
  cynthia: ['cindy'],
  deborah: ['debbie', 'deb'],
  diana: ['di'],
  dorothy: ['dot', 'dottie', 'dolly'],
  eleanor: ['ellie', 'ella', 'nell', 'nelly'],
  elizabeth: ['liz', 'lizzy', 'beth', 'betty', 'eliza', 'ellie', 'lisa', 'bess', 'bessie'],
  emily: ['em', 'emmy'],
  frances: ['fran', 'frannie'],
  gabrielle: ['gabby', 'gabi'],
  gertrude: ['gertie', 'trudy'],
  helen: ['nell', 'nelly', 'ellie'],
  jacqueline: ['jackie', 'jacqui'],
  jane: ['janie', 'jenny'],
  janet: ['jan'],
  jennifer: ['jen', 'jenny', 'jenn'],
  jessica: ['jess', 'jessie'],
  joan: ['joanie'],
  josephine: ['jo', 'josie'],
  judith: ['judy', 'judi'],
  julia: ['julie', 'jules'],
  karen: ['kari'],
  katherine: ['kate', 'katie', 'kathy', 'kat', 'kit', 'kitty'],
  kathleen: ['kate', 'kathy', 'kat'],
  kimberly: ['kim', 'kimmy'],
  laura: ['laurie'],
  linda: ['lindy'],
  louise: ['lou'],
  lucy: ['lu'],
  margaret: ['maggie', 'meg', 'marge', 'margie', 'peggy', 'daisy', 'rita'],
  maria: ['marie'],
  martha: ['marty', 'mattie'],
  mary: ['mae', 'molly', 'polly', 'mamie', 'mitzi'],
  melissa: ['missy', 'mel'],
  nancy: ['nan', 'nanny'],
  natalie: ['nat', 'natty'],
  pamela: ['pam', 'pammy'],
  patricia: ['pat', 'patty', 'trish', 'tricia'],
  pauline: ['polly'],
  penelope: ['penny'],
  priscilla: ['prissy', 'cilla'],
  rachel: ['rae'],
  rebecca: ['becky', 'becca'],
  rosemary: ['rosie', 'rose'],
  samantha: ['sam', 'sammy'],
  sandra: ['sandy', 'sadie'],
  sarah: ['sally', 'sadie'],
  sophia: ['sophie'],
  stephanie: ['steph', 'stephie'],
  susan: ['sue', 'susie', 'suzy'],
  suzanne: ['sue', 'susie', 'suzy'],
  teresa: ['terry', 'tess', 'tessa'],
  theresa: ['terry', 'tess', 'tessa'],
  valerie: ['val'],
  veronica: ['ronnie', 'roni'],
  victoria: ['vicky', 'tori'],
  virginia: ['ginny', 'ginger'],
  vivian: ['viv'],

  // Gender-neutral / Modern
  armani: ['aj', 'mani'],
  jordan: ['jordy'],
  taylor: ['tay'],
  cameron: ['cam'],
  morgan: ['mo'],
  riley: ['ri'],
  casey: ['case'],
  avery: ['ave'],
  skyler: ['sky'],
};

// Build reverse lookup for efficiency
const NICKNAME_REVERSE = new Map<string, Set<string>>();

for (const [formal, nicks] of Object.entries(NICKNAME_MAP)) {
  // Add formal -> itself
  if (!NICKNAME_REVERSE.has(formal)) {
    NICKNAME_REVERSE.set(formal, new Set());
  }
  NICKNAME_REVERSE.get(formal)!.add(formal);

  // Add all nicknames to formal's set and vice versa
  for (const nick of nicks) {
    NICKNAME_REVERSE.get(formal)!.add(nick);

    if (!NICKNAME_REVERSE.has(nick)) {
      NICKNAME_REVERSE.set(nick, new Set());
    }
    NICKNAME_REVERSE.get(nick)!.add(formal);
    NICKNAME_REVERSE.get(nick)!.add(nick);

    // Connect nicknames to each other through the formal name
    for (const otherNick of nicks) {
      NICKNAME_REVERSE.get(nick)!.add(otherNick);
    }
  }
}

/**
 * Check if two names are known nickname variants of each other
 */
export function areNicknames(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;

  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  // Exact match
  if (n1 === n2) return true;

  // Check nickname mapping
  const n1Set = NICKNAME_REVERSE.get(n1);
  if (n1Set && n1Set.has(n2)) return true;

  // Check if one is initial of the other
  if (n1.length === 1 && n2.startsWith(n1)) return true;
  if (n2.length === 1 && n1.startsWith(n2)) return true;

  // Check if one is prefix of other (min 2 chars, and shorter is at least half)
  if (n1.length >= 2 && n2.startsWith(n1) && n1.length >= n2.length / 2) return true;
  if (n2.length >= 2 && n1.startsWith(n2) && n2.length >= n1.length / 2) return true;

  return false;
}

/**
 * Get all known variants for a name
 */
export function getNicknameVariants(name: string): string[] {
  if (!name) return [];
  const n = name.toLowerCase().trim();
  const variants = NICKNAME_REVERSE.get(n);
  return variants ? Array.from(variants) : [n];
}

/**
 * Check if name could be initials + last name pattern
 * e.g., "AJ" could match "Armani" (first letter matches)
 */
export function couldBeInitials(potentialInitials: string, fullName: string): boolean {
  if (!potentialInitials || !fullName) return false;

  const initials = potentialInitials.toUpperCase();
  const full = fullName.toLowerCase();

  // Must be 1-3 uppercase letters
  if (!/^[A-Z]{1,3}$/.test(initials)) return false;

  // First letter must match
  return initials[0] === full[0].toUpperCase();
}
