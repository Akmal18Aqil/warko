/**
 * Password policy and the common-password denylist.
 *
 * The list holds well-known leaked/guessable passwords of 8+ characters (the minimum length), taken
 * from public breach corpora (RockYou, NCSC/SecLists top lists) plus common Indonesian choices.
 * Entries are lowercase; candidates are compared case-insensitively.
 */
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 256;

const COMMON_PASSWORDS: ReadonlySet<string> = new Set(
  `
password passw0rd password1 password12 password123 password1234 password12345 password123456 password1! password! p@ssw0rd p@ssword p@ssw0rd1 pa$$w0rd pa55word pa55w0rd
12345678 123456789 1234567890 12345678910 123123123 1234567 123454321 11111111 111111111 1111111111 22222222 33333333 44444444 55555555 66666666 77777777 88888888 99999999 00000000 000000000 0000000000 12341234 12121212 11223344 1q2w3e4r 1q2w3e4r5t 1qaz2wsx 1qaz2wsx3edc 1q2w3e4r5t6y 1qazxsw2 1qaz!qaz qwertyui qwertyuiop qwerty12 qwerty123 qwerty1234 qwerty12345 qwerty123456 qwertyu1 qwerty12! qwertyuiop123 qwerasdf qazwsxedc qazwsx123 qazwsxedcrfv asdfghjk asdfghjkl asdfgh123 asdf1234 asdfasdf asdfghjkl123 zxcvbnm1 zxcvbnm123 zxcvbnm, zxcvbnmasdfghjkl asdfjkl; abcd1234 abcd12345 abcdefgh abcdefg1 abcdefgh1 abc12345 abc123456 abcabc123 abc1234567 a1b2c3d4 a1b2c3d4e5
letmein1 letmein123 welcome1 welcome12 welcome123 welcome1234 welcome@123 welcome! admin123 admin1234 admin12345 admin@123 admin@1234 administrator administrator1 admin1234! adminadmin admin2020 admin2021 admin2022 admin2023 admin2024 admin2025 admin2026 root1234 root12345 rootroot toor1234 superuser supervisor manager1 manager123 kasir123 kasir1234 kasir12345 kasirkasir kasir@123 kasirresto restoran restoran1 restoran123 restoran1234 restoran@123 restaurant restaurant1 restaurant123 resto123 resto1234 resto12345 warung123 warung1234 wakro123 wakro1234 wakro12345 wakrowakro kasapos123 kasa1234 kasapos kasapos1 kasa12345 pelayan123 pelayan1234 dapur123 dapur1234 pos12345 pos123456 posadmin
iloveyou iloveyou1 iloveyou123 iloveyou2 iloveyou! ilovegod ilovehim ilovemyself iloveu123 iloveyou12 loveyou1 loveyou123 loveyou2 loveyou! lovelove lovely123 loveme123 loveyou12 sayangku sayang123 sayangkamu sayang1234 aku123456 akucintakamu cintakamu cinta123 cinta1234 cinta12345 cintaku123 cintaku1 sayangaku kamusiapa
monkey123 monkey12 dragon123 dragon12 master123 master12 shadow123 shadow12 sunshine sunshine1 sunshine123 princess princess1 princess123 football football1 football123 baseball baseball1 basketball soccer123 soccer12 superman superman1 superman123 batman123 batman12 spiderman spiderman1 trustno1 trustno12 whatever whatever1 freedom1 freedom123 starwars starwars1 michael1 michael123 jordan23 jennifer jennifer1 jessica1 jessica123 ashley123 daniel123 matthew1 charlie1 charlie123 hannah123 thomas123 andrew123 joshua123 nicole123 jasmine1 jasmine123 hunter123 hunter12 tigger123 pepper123 ginger123 buster123 summer123 summer2020 summer2021 summer2022 summer2023 summer2024 summer2025 winter2020 winter2021 winter2022 winter2023 winter2024 winter2025 spring2024 spring2025 autumn2024 autumn2025
computer computer1 computer123 internet internet1 internet123 samsung1 samsung123 iphone123 android123 google123 google12 facebook facebook1 facebook123 youtube123 instagram instagram1 twitter123 whatsapp whatsapp1 telegram1 gmail123 yahoo123 hotmail123 mypassword mypassword1 mypassword123 mypass123 mypassw0rd thepassword newpassword newpassword1 newpass123 newpassw0rd changeme changeme1 changeme123 changeit default123 default1234 test1234 test12345 test123456 testing123 testtest testing1 tester123 sample123 guest1234 guest12345 qwertyuiop1 passpass passpass1 pass1234 pass12345 pass123456 password01 password02 password007 passwort passwort1 contrasena contrasena1 motdepasse
indonesia indonesia1 indonesia123 indonesia1945 indonesiaraya merdeka1945 merdeka123 garudapancasila pancasila pancasila1 jakarta123 jakarta1234 bandung123 surabaya123 medan1234 bali12345 jogja123 yogyakarta semarang123 makassar123 palembang123 bekasi123 depok123 tangerang123 bogor1234 sumatera123 kalimantan sulawesi123 papua1234 sandibaru katasandi katasandi1 katasandi123 kata sandi123 rahasia123 rahasia1 rahasia1234 rahasia12 rahasiaku rahasiaku1 bismillah bismillah1 bismillah123 alhamdulillah allahuakbar allah12345 muhammad muhammad1 muhammad123 assalamualaikum jakartakeras indonesiaku anakindonesia terserah123 terserah gantengbanget cantikbanget gantengku123 cantikku123 anjing123 bangsat123 bajingan123 kontol123 memek123 sayangmama mamapapa mama1234 papa1234 mamamama sukasuka gakada123 gaktau123 lupapassword lupasandi passwordku passwordku1 passwordbaru sandi123 sandi1234 sandi12345 sandikuat
arsenal1 arsenal123 chelsea1 chelsea123 liverpool liverpool1 manutd123 manchester barcelona barcelona1 realmadrid realmadrid1 juventus1 persija123 persib123 arema1234 bonek1234 viking123 aremania persebaya ronaldo7 ronaldo123 messi1234 messi123 cristiano naruto123 naruto1234 narutouzumaki sasuke123 doraemon doraemon1 doraemon123 pokemon1 pokemon123 minecraft minecraft1 minecraft123 fortnite1 freefire123 mobilelegends pubgmobile roblox123 gamer123 gaming123
rockyou1 rockyou123 blink182 metallica nirvana1 linkinpark slipknot1 eminem123 beatles1 acdc1234 mustang1 mustang123 corvette ferrari1 ferrari123 porsche911 camaro123 harley123 yamaha123 honda1234 suzuki123 kawasaki toyota123 hello123 hello1234 hello12345 hellohello helloworld helloworld1 helloworld123 hello@123 hi123456 hithere123 goodluck goodluck1 goodmorning goodnight1 godbless1 godisgood jesus123 jesuschrist jesus1234 blessed1 blessing1 thankyou thankyou1 thankyou123 gracias1 america1 america123 canada123 england1 london123 paris123 newyork1 newyork123 california texas123 chicago1 hollywood hollywood1 qazwsxedc1 zaq12wsx zaq1zaq1 zaq12wsxcde xsw2zaq1 q1w2e3r4 q1w2e3r4t5 q1w2e3r4t5y6 qweasdzxc qweasd123 qweqweqwe qweqwe123 qwe12345 qwe123456 qwe123qwe qweasdzxc123 asdasd123 asdasdasd asd12345 asd123456 asd123asd asdzxc123 zxczxczxc zxc12345 zxc123456 zxcasdqwe
iloveyou3 football7 password9 password8 password7 password6 password5 password4 password3 password2 pass@123 pass@1234 pass@word1 passw0rd1 passw0rd! p@55w0rd p@$$w0rd p@ssw0rd! password@1 password@123 password#1 password*1 secret123 secret1234 secret12 secretpass secret007 letmein! letmein12 letmeinnow login123 login1234 loginlogin logmein1 logmein123 access123 access14 openup123 opensesame opensesame1 sesame123 mysecret1 mysecret123 mysecret iamthebest iamawesome iamgod123 godmode1 passme123 trustme1 trustme123 killer123 killer1234 killer12 hacker123 hacker1234 hackme123 hackerman cracker1 cheese123 chocolate chocolate1 cookie123 cookies1 banana123 banana12 apple1234 apple12345 applepie1 orange123 lemon1234 cherry123 peaches1 pumpkin1 pizza1234 pizza123 burger123 coffee123 coffee12 beer1234 whiskey1 vodka1234 tequila1
`
    .split(/\s+/)
    .filter((entry) => entry.length >= MIN_PASSWORD),
);

/** Short (6-7 letter) bases that are only rejected when someone pads them ("Qwerty123!"). */
const COMMON_STEMS: ReadonlySet<string> = new Set([
  "qwerty",
  "monkey",
  "dragon",
  "master",
  "shadow",
  "letmein",
  "sayang",
  "rahasia",
  "bismillah",
  "welcome",
  "secret",
  "iloveu",
  "abcdef",
  "google",
  "restoran",
]);

/** Reduces a candidate to the stem people actually mutate: "Password1!" → "password". */
function stem(lower: string): string {
  return lower.replace(/[\d!@#$%^&*._\-+=? ]+$/, "");
}

/** Digit-only passwords that are just a repeat or a straight run (12345678, 87654321, 00000000). */
function isTrivialDigits(password: string): boolean {
  if (!/^\d+$/.test(password)) return false;
  if (new Set(password).size === 1) return true;
  let up = true;
  let down = true;
  for (let i = 1; i < password.length; i++) {
    const step = Number(password[i]) - Number(password[i - 1]);
    if (step !== 1 && !(step === -9 && password[i - 1] === "9")) up = false;
    if (step !== -1 && !(step === 9 && password[i - 1] === "0")) down = false;
  }
  return up || down;
}

export function isCommonPassword(password: string): boolean {
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || isTrivialDigits(password)) return true;
  const base = stem(lower);
  // A stem of 6+ letters is still a dictionary word ("password" + digits); shorter stems are too thin to judge.
  return base.length >= 6 && base !== lower && (COMMON_PASSWORDS.has(base) || COMMON_STEMS.has(base));
}

/** Strong-password policy for any password the server will store. Returns error messages (empty = ok). */
export function passwordErrors(password: string, username: string): string[] {
  const errors: string[] = [];
  if (password.length < MIN_PASSWORD) errors.push(`password minimal ${MIN_PASSWORD} karakter.`);
  if (password.length > MAX_PASSWORD) errors.push(`password maksimal ${MAX_PASSWORD} karakter.`);
  if (password.trim().length === 0) errors.push("password tidak boleh hanya spasi.");
  if (new Set(password).size < 4) errors.push("password terlalu mudah ditebak.");
  if (username && password.toLowerCase().includes(username)) errors.push("password tidak boleh memuat nama pengguna.");
  if (password.length >= MIN_PASSWORD && isCommonPassword(password)) {
    errors.push("password terlalu umum dan mudah ditebak. Gunakan kombinasi yang lebih unik.");
  }
  return errors;
}
