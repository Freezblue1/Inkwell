/**
 * Offline character-name generator.
 *
 * First names are grouped by generation so a character can sound their age:
 * "young" names are popular for people born roughly 2005–2020, "adult" names
 * for 1965–1995 and "old" names for 1930–1960. Styles that cover several
 * countries (Celtic, Slavic) keep each country's first names and surnames
 * together, and surnames change form for women where the language does
 * (Petrov → Petrova, Novák → Nováková, Papadopoulos → Papadopoulou).
 */

export type NameStyle =
  | 'english'
  | 'celtic'
  | 'nordic'
  | 'french'
  | 'spanish'
  | 'italian'
  | 'german'
  | 'slavic'
  | 'greek'
  | 'arabic'
  | 'indian'
  | 'chinese'
  | 'japanese'
  | 'korean'
  | 'fantasy';
export type NameGender = 'any' | 'feminine' | 'masculine';
export type NameAge = 'any' | 'child' | 'young' | 'middle' | 'elderly';

type Tier = 'young' | 'adult' | 'old';
type Tiered = Record<Tier, string[]>;

interface Region {
  /** Shown next to each name when a style mixes countries. */
  origin: string;
  feminine: Tiered;
  masculine: Tiered;
  surnames: string[];
  /** A surname's feminine form, for languages that have one. */
  femSurname?: (s: string) => string;
  /** Chance of a second surname (Spanish: father's then mother's). */
  doubleSurname?: number;
}

interface StyleData {
  label: string;
  regions: Region[];
}

const w = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
const tiers = (young: string, adult: string, old: string): Tiered => ({ young: w(young), adult: w(adult), old: w(old) });

// ── Feminine surname forms ──────────────────────────────────────────────
const russianFem = (s: string) => (/(ov|ev|in|yn)$/.test(s) ? `${s}a` : s.endsWith('sky') ? `${s.slice(0, -1)}aya` : s);
const polishFem = (s: string) => (/(sk|ck|dzk)i$/.test(s) ? `${s.slice(0, -1)}a` : s);
const czechFem = (s: string) => {
  if (s.endsWith('ý')) return `${s.slice(0, -1)}á`;
  if (s.endsWith('ek')) return `${s.slice(0, -2)}ková`;
  if (s.endsWith('ec')) return `${s.slice(0, -2)}cová`;
  if (s.endsWith('a')) return `${s.slice(0, -1)}ová`;
  return `${s}ová`;
};
const greekFem = (s: string) => (s.endsWith('os') ? `${s.slice(0, -2)}ou` : s.endsWith('is') ? s.slice(0, -1) : s.endsWith('as') ? s.slice(0, -1) : s);

export const NAME_STYLES: Record<Exclude<NameStyle, 'fantasy'>, StyleData> = {
  english: {
    label: 'English',
    regions: [
      {
        origin: 'English',
        feminine: tiers(
          'Olivia, Amelia, Isla, Ava, Mia, Ivy, Freya, Lily, Ella, Sophie, Willow, Harper, Evie, Poppy, Aria, Zoe, Ruby, Isabella, Maya, Hazel, Luna, Nova, Scarlett, Madison, Aurora, Millie, Layla, Delilah, Elodie, Margot',
          'Sarah, Emma, Rachel, Claire, Laura, Rebecca, Jennifer, Jessica, Nicola, Amanda, Lisa, Kelly, Michelle, Joanne, Helen, Natalie, Hannah, Lauren, Stephanie, Gemma, Melissa, Heather, Amy, Danielle, Kirsty, Tracey, Angela, Samantha, Victoria, Caroline',
          'Margaret, Dorothy, Joan, Patricia, Barbara, Jean, Brenda, Sheila, Shirley, Maureen, Irene, Doris, Betty, Pauline, Sylvia, Marjorie, Gladys, Mavis, Audrey, Rita, Edna, Norma, Beryl, Phyllis, Elsie, Judith, Carol, Valerie, Winifred, June',
        ),
        masculine: tiers(
          'Oliver, Noah, Leo, Arthur, Theo, Jack, Harry, Oscar, Charlie, Freddie, Archie, Finley, Mason, Ethan, Liam, Lucas, Jacob, Logan, Riley, Alfie, Jayden, Elijah, Hudson, Kai, Ezra, Rory, Toby, Reuben, Max, Ronan',
          'David, Mark, Paul, Andrew, Richard, Steven, Christopher, Matthew, Daniel, James, Simon, Darren, Jason, Craig, Gary, Scott, Kevin, Neil, Lee, Adam, Ryan, Ben, Jonathan, Martin, Wayne, Shaun, Jeremy, Nicholas, Anthony, Justin',
          'Harold, Kenneth, Ronald, Donald, Gerald, Dennis, Bernard, Leslie, Stanley, Clifford, Norman, Raymond, Frank, Albert, Walter, Ernest, Herbert, Cyril, Eric, Roy, Derek, Reginald, Trevor, Geoffrey, Brian, Keith, Alan, Colin, Malcolm, Graham',
        ),
        surnames: w(
          'Abbott, Ashdown, Barker, Bennett, Blackwood, Brooks, Carter, Chapman, Cole, Cooper, Crane, Davenport, Dawson, Ellis, Fairfax, Fisher, Fletcher, Foster, Gardner, Gray, Hale, Hartley, Hayes, Hobbs, Holloway, Hughes, Jennings, Kemp, Knight, Lambert, Lawson, Lockwood, Marsh, Mercer, Morley, Norris, Palmer, Parker, Pembroke, Reed, Rowe, Russell, Shaw, Sutton, Thorne, Turner, Webb, Wells, Whitaker, Whitlock, Wren, Yardley',
        ),
      },
    ],
  },
  celtic: {
    label: 'Celtic (Irish, Scottish, Welsh)',
    regions: [
      {
        origin: 'Irish',
        feminine: tiers(
          'Aoife, Saoirse, Caoimhe, Éabha, Róisín, Fiadh, Clodagh, Ciara, Niamh, Laoise, Sadhbh, Ailbhe, Muireann, Síofra, Grace',
          'Siobhán, Sinéad, Deirdre, Gráinne, Áine, Aisling, Orla, Úna, Edel, Fiona, Tríona, Majella, Yvonne, Gemma, Nóirín',
          'Mary, Bridget, Kathleen, Maureen, Eileen, Nora, Peig, Bríd, Nuala, Sheila, Philomena, Kitty, Josephine, Bernadette, Agnes',
        ),
        masculine: tiers(
          'Oisín, Fionn, Cillian, Tadhg, Darragh, Rían, Cian, Oran, Senan, Lorcan, Odhran, Ruairí, Conall, Tiernan, Sé',
          'Declan, Colm, Ciarán, Niall, Ronan, Conor, Eoin, Diarmuid, Kieran, Barry, Cathal, Fergal, Damien, Brian, Shane',
          'Patrick, Seamus, Michael, Brendan, Dermot, Eamon, Malachy, Cornelius, Padraig, Christy, Liam, Donal, Gerard, Fintan, Kevin',
        ),
        surnames: w(
          "Brennan, Byrne, Callaghan, Doherty, Doyle, Duffy, Dunne, Fitzgerald, Flanagan, Gallagher, Hegarty, Kavanagh, Keane, Kennedy, Lynch, Maguire, McCarthy, Moran, Murphy, Nolan, O'Brien, O'Connell, O'Sullivan, Quinn, Reilly, Ryan, Sweeney, Walsh, Whelan, Mulcahy",
        ),
      },
      {
        origin: 'Scottish',
        feminine: tiers(
          'Isla, Eilidh, Ailsa, Skye, Mairi, Iona, Rowan, Esme, Islay, Thea, Kenzie, Brodie, Orla, Freya, Rose',
          'Fiona, Catriona, Shona, Kirsty, Mhairi, Lorna, Gillian, Lesley, Morven, Kirsteen, Arlene, Nicola, Heather, Lynne, Shonagh',
          'Morag, Moira, Jean, Agnes, Elspeth, Isobel, Senga, Effie, Jessie, Annie, Margaret, Euphemia, Flora, Christina, Wilma',
        ),
        masculine: tiers(
          'Finlay, Lachlan, Rory, Harris, Struan, Lewis, Brodie, Arran, Ruaridh, Cameron, Kyle, Innes, Callan, Fraser, Alfie',
          'Callum, Euan, Iain, Ewan, Stuart, Graeme, Craig, Scott, Gavin, Ross, Grant, Kenny, Neil, Barry, Gordon',
          'Hamish, Angus, Dougal, Murdo, Alasdair, Archibald, Fergus, Duncan, Hector, Willie, Torquil, Douglas, Malcolm, Ruaraidh, Lachie',
        ),
        surnames: w(
          'Abernethy, Baird, Buchanan, Campbell, Cunningham, Douglas, Drummond, Ferguson, Fraser, Gillies, Grant, Henderson, Kerr, Lennox, MacDonald, MacGregor, MacKenzie, MacLean, MacLeod, Mackintosh, McIntyre, Moffat, Morrison, Munro, Murray, Robertson, Ross, Rutherford, Sinclair, Stewart',
        ),
      },
      {
        origin: 'Welsh',
        feminine: tiers(
          'Seren, Alys, Mali, Efa, Nel, Lili, Eira, Gwenllian, Elan, Megan, Tesni, Mabli, Hafwen, Cadi, Lowri',
          'Rhiannon, Bethan, Sian, Carys, Nia, Angharad, Catrin, Delyth, Ffion, Llinos, Elin, Heledd, Manon, Eleri, Cerys',
          'Myfanwy, Gwyneth, Blodwen, Dilys, Glenys, Mair, Olwen, Bronwen, Eirlys, Gwen, Nesta, Morfydd, Enid, Ceinwen, Menna',
        ),
        masculine: tiers(
          'Osian, Macsen, Ioan, Elis, Tomos, Harri, Cai, Gruff, Twm, Jac, Llew, Deio, Iestyn, Taliesin, Emyr',
          'Rhys, Owain, Gethin, Iwan, Aled, Rhodri, Gareth, Dafydd, Geraint, Rhydian, Gruffydd, Ieuan, Hywel, Steffan, Meirion',
          'Gwilym, Emrys, Idris, Dai, Islwyn, Glyn, Emlyn, Trefor, Dewi, Huw, Aneurin, Elwyn, Iorwerth, Bryn, Ifor',
        ),
        surnames: w(
          'Bevan, Bowen, Davies, Evans, Griffiths, Gwynne, Howell, Hughes, Humphreys, Jenkins, Jones, Lewis, Llewellyn, Lloyd, Meredith, Morgan, Owen, Parry, Powell, Price, Pritchard, Probert, Prosser, Pugh, Rees, Roberts, Rowlands, Thomas, Vaughan, Watkins',
        ),
      },
    ],
  },
  nordic: {
    label: 'Nordic',
    regions: [
      {
        origin: 'Nordic',
        feminine: tiers(
          'Freja, Ella, Alma, Saga, Maja, Ebba, Nora, Ida, Wilma, Selma, Signe, Tuva, Thea, Frida, Linnea, Agnes, Vilde, Liv, Ellinor, Juni',
          'Camilla, Hanne, Mette, Lene, Annika, Malin, Jenny, Linda, Hilde, Tove, Kristin, Susanne, Heidi, Lotta, Pernilla, Trine, Marianne, Therese, Siri, Sanna',
          'Ingrid, Birgit, Gunhild, Astrid, Solveig, Ragnhild, Karin, Britt, Gerd, Margit, Ingeborg, Elsa, Greta, Sigrid, Ulla, Kerstin, Inger, Märta, Aud, Berit',
        ),
        masculine: tiers(
          'William, Lucas, Oscar, Elias, Noah, Liam, Hugo, Axel, Emil, Viktor, Filip, Isak, Aksel, Theo, Malte, Alfred, Sigurd, Ludvig, Edvin, Birk',
          'Anders, Lars, Mikael, Henrik, Jonas, Morten, Thomas, Per, Johan, Fredrik, Magnus, Stefan, Martin, Rasmus, Jesper, Kristian, Tobias, Ola, Mats, Niklas',
          'Gunnar, Olav, Torbjørn, Sven, Bengt, Gösta, Arne, Leif, Knut, Einar, Halvard, Ragnar, Harald, Sten, Åke, Rolf, Bjørn, Kjell, Ingvar, Torvald',
        ),
        surnames: w(
          'Andersen, Bakke, Berg, Brekke, Dahl, Ek, Engström, Eriksson, Fjeld, Halvorsen, Hansen, Haugen, Holm, Johansson, Kristiansen, Larsen, Lind, Lindgren, Lindholm, Lindqvist, Lund, Moen, Nilsson, Nygaard, Nyström, Pedersen, Sandberg, Sjöberg, Solberg, Sørensen, Strand, Viklund, Wallin, Åberg',
        ),
      },
    ],
  },
  french: {
    label: 'French',
    regions: [
      {
        origin: 'French',
        feminine: tiers(
          'Jade, Louise, Emma, Alice, Chloé, Inès, Léa, Lina, Rose, Anna, Mila, Ambre, Juliette, Agathe, Léonie, Zoé, Manon, Camille, Margaux, Romane, Iris, Lou',
          'Nathalie, Isabelle, Sandrine, Sophie, Céline, Valérie, Stéphanie, Virginie, Aurélie, Émilie, Delphine, Caroline, Karine, Laurence, Véronique, Christelle, Élodie, Audrey, Mélanie, Julie',
          'Jeanne, Marguerite, Simone, Germaine, Odette, Paulette, Yvonne, Huguette, Monique, Jacqueline, Denise, Colette, Suzanne, Geneviève, Madeleine, Thérèse, Lucienne, Ginette, Renée, Josette',
        ),
        masculine: tiers(
          'Gabriel, Léo, Raphaël, Louis, Arthur, Jules, Adam, Maël, Lucas, Hugo, Noah, Paul, Sacha, Gaspard, Nathan, Théo, Malo, Aaron, Victor, Timothée, Baptiste, Martin',
          'Christophe, Stéphane, Laurent, Sébastien, Nicolas, Frédéric, Olivier, Thierry, Philippe, Éric, Pascal, Julien, Guillaume, Vincent, Jérôme, Fabien, Cédric, Arnaud, Ludovic, Benoît',
          'Marcel, René, André, Roger, Robert, Georges, Lucien, Maurice, Henri, Raymond, Gilbert, Fernand, Jacques, Claude, Bernard, Gérard, Pierre, Michel, Jean-Claude, Guy',
        ),
        surnames: w(
          'Aubert, Bernard, Blanc, Bonnet, Brunet, Castellane, Chevalier, Delacroix, Dubois, Dupont, Durand, Duval, Faure, Fontaine, Fournier, Garnier, Gauthier, Girard, Lambert, Laurent, Lefèvre, Lemaire, Leroy, Marchand, Masson, Mercier, Moreau, Morel, Perrin, Picard, Renaud, Rousseau, Roux, Valcourt, Vidal',
        ),
      },
    ],
  },
  spanish: {
    label: 'Spanish & Latin American',
    regions: [
      {
        origin: 'Spanish',
        feminine: tiers(
          'Lucía, Sofía, Martina, Valentina, Daniela, Valeria, Julia, Paula, Carla, Olivia, Alba, Vega, Lola, Ximena, Renata, Camila, Regina, Abril, Mía, Noa, Aitana, Jimena',
          'María José, Laura, Cristina, Marta, Raquel, Silvia, Patricia, Elena, Beatriz, Susana, Mónica, Verónica, Natalia, Ana Belén, Yolanda, Lorena, Paola, Gabriela, Alejandra, Leticia',
          'Carmen, Dolores, Pilar, Mercedes, Josefa, Concepción, Rosario, Remedios, Encarnación, Amparo, Consuelo, Teresa, Antonia, Guadalupe, Esperanza, Inmaculada, Montserrat, Asunción, Rosa, Francisca',
        ),
        masculine: tiers(
          'Hugo, Mateo, Martín, Lucas, Leo, Pablo, Álvaro, Enzo, Marco, Thiago, Santiago, Gael, Diego, Bruno, Izan, Mario, Adrián, Nicolás, Sebastián, Emiliano, Unai, Iker',
          'Javier, David, Daniel, Sergio, Alberto, Carlos, Raúl, Rubén, Óscar, Jorge, Iván, Alejandro, Roberto, Fernando, Miguel Ángel, Luis, Eduardo, Ricardo, Gustavo, Héctor',
          'José, Antonio, Manuel, Francisco, Juan, Jesús, Ramón, Joaquín, Eusebio, Fermín, Agustín, Pedro, Vicente, Andrés, Rafael, Emilio, Ignacio, Salvador, Ernesto, Aurelio',
        ),
        surnames: w(
          'Aguilar, Arroyo, Blanco, Cabrera, Castro, Cortés, Delgado, Domínguez, Fernández, Fuentes, García, Gómez, González, Herrera, Iglesias, López, Martínez, Medina, Molina, Montero, Morales, Navarro, Ortega, Peña, Pérez, Ramos, Reyes, Rodríguez, Romero, Ruiz, Sánchez, Serrano, Suárez, Vargas, Vega',
        ),
        doubleSurname: 0.45,
      },
    ],
  },
  italian: {
    label: 'Italian',
    regions: [
      {
        origin: 'Italian',
        feminine: tiers(
          'Sofia, Giulia, Aurora, Ginevra, Alice, Beatrice, Emma, Vittoria, Ludovica, Matilde, Gaia, Bianca, Nicole, Greta, Martina, Azzurra, Noemi, Camilla, Viola, Arianna',
          'Francesca, Chiara, Valentina, Federica, Silvia, Elisa, Paola, Laura, Roberta, Simona, Barbara, Monica, Daniela, Cristina, Elena, Manuela, Alessandra, Serena, Stefania, Michela',
          'Maria, Giuseppina, Anna, Rosa, Angela, Giovanna, Teresa, Lucia, Carmela, Concetta, Antonietta, Franca, Bruna, Rita, Lina, Gina, Assunta, Iolanda, Ida, Graziella',
        ),
        masculine: tiers(
          'Leonardo, Francesco, Tommaso, Lorenzo, Edoardo, Gabriele, Mattia, Diego, Filippo, Samuele, Christian, Giacomo, Elia, Nicolò, Enea, Achille, Cesare, Jacopo, Ettore, Alessio',
          'Marco, Andrea, Alessandro, Luca, Matteo, Stefano, Davide, Simone, Fabio, Massimo, Roberto, Paolo, Daniele, Riccardo, Claudio, Gianluca, Maurizio, Emanuele, Federico, Nicola',
          'Giuseppe, Giovanni, Antonio, Mario, Luigi, Angelo, Vincenzo, Pietro, Salvatore, Carlo, Bruno, Sergio, Franco, Renato, Aldo, Gino, Umberto, Arturo, Ottavio, Raffaele',
        ),
        surnames: w(
          'Barbieri, Bellini, Bianchi, Bruno, Caruso, Colombo, Conti, Coppola, Costa, De Luca, Esposito, Ferrante, Ferrari, Fontana, Gallo, Gentile, Giordano, Greco, Leone, Lombardi, Longo, Mancini, Mariani, Marino, Martinelli, Moretti, Ricci, Rinaldi, Rizzo, Romano, Rossi, Russo, Santoro, Serra, Vitale',
        ),
      },
    ],
  },
  german: {
    label: 'German',
    regions: [
      {
        origin: 'German',
        feminine: tiers(
          'Emilia, Mia, Hannah, Emma, Lina, Mila, Ella, Clara, Lea, Leni, Marie, Ida, Frieda, Greta, Mathilda, Johanna, Paula, Lotta, Charlotte, Ronja, Luisa, Malia',
          'Sabine, Petra, Andrea, Claudia, Stefanie, Susanne, Nicole, Katrin, Anja, Melanie, Sandra, Daniela, Silke, Tanja, Birgit, Kerstin, Julia, Christina, Nadine, Bettina',
          'Ursula, Helga, Ingrid, Gisela, Renate, Brigitte, Hildegard, Elfriede, Gertrud, Erika, Christa, Irmgard, Waltraud, Lieselotte, Margarete, Hannelore, Edith, Karin, Rosemarie, Inge',
        ),
        masculine: tiers(
          'Noah, Matteo, Leon, Paul, Finn, Elias, Felix, Ben, Luca, Henry, Emil, Theo, Anton, Jonas, Maximilian, Mats, Jakob, Lukas, Oskar, Moritz, Valentin, Linus',
          'Thomas, Michael, Stefan, Andreas, Frank, Markus, Christian, Sven, Jens, Torsten, Dirk, Matthias, Oliver, Tobias, Florian, Sebastian, Holger, Ralf, Uwe, Jan',
          'Hans, Günter, Klaus, Dieter, Helmut, Horst, Werner, Manfred, Wolfgang, Gerhard, Heinz, Karl-Heinz, Jürgen, Rolf, Siegfried, Kurt, Walter, Erwin, Friedrich, Otto',
        ),
        surnames: w(
          'Albrecht, Baumann, Becker, Brandt, Braun, Engel, Falk, Fischer, Hartmann, Hoffmann, Kaiser, Klein, Koch, Köhler, Krause, Krüger, Lange, Lehmann, Lorenz, Meyer, Müller, Neumann, Richter, Schmidt, Schneider, Schröder, Schulz, Schwarz, Vogel, Wagner, Weber, Werner, Winkler, Wolf, Zimmermann',
        ),
      },
    ],
  },
  slavic: {
    label: 'Slavic (Russian, Polish, Czech)',
    regions: [
      {
        origin: 'Russian',
        feminine: tiers(
          'Sofia, Anastasia, Polina, Alisa, Varvara, Milana, Vasilisa, Zlata, Kira, Ulyana, Arina, Darya, Veronika, Eva, Taisiya',
          'Natalia, Svetlana, Olga, Irina, Elena, Marina, Yulia, Ekaterina, Tatiana, Larisa, Inna, Yana, Alla, Oksana, Zhanna',
          'Lyudmila, Valentina, Galina, Tamara, Nina, Zinaida, Raisa, Nadezhda, Lidia, Antonina, Klavdia, Vera, Zoya, Evdokia, Praskovya',
        ),
        masculine: tiers(
          'Artyom, Maksim, Matvei, Lev, Mark, Timofei, Ivan, Kirill, Yaroslav, Arseny, Fyodor, Gleb, Platon, Miron, Savva',
          'Dmitri, Sergei, Alexei, Andrei, Igor, Oleg, Pavel, Roman, Denis, Konstantin, Vadim, Ruslan, Evgeny, Anton, Stanislav',
          'Vladimir, Nikolai, Boris, Gennady, Vasily, Anatoly, Valery, Yuri, Leonid, Viktor, Arkady, Pyotr, Grigory, Semyon, Stepan',
        ),
        surnames: w(
          'Belov, Bogdanov, Egorov, Fedorov, Golubev, Gromov, Ilyin, Ivanov, Kalinin, Karpov, Kozlov, Kuznetsov, Lebedev, Medvedev, Morozov, Nikitin, Novikov, Orlov, Pavlov, Petrov, Popov, Romanov, Smirnov, Sokolov, Tarasov, Vasiliev, Vinogradov, Volkov, Zaitsev, Zhukov',
        ),
        femSurname: russianFem,
      },
      {
        origin: 'Polish',
        feminine: tiers(
          'Zuzanna, Julia, Hanna, Maja, Lena, Alicja, Oliwia, Laura, Pola, Antonina, Nadia, Liliana, Amelia, Wiktoria, Iga',
          'Agnieszka, Katarzyna, Magdalena, Joanna, Monika, Anna, Ewa, Małgorzata, Beata, Dorota, Aleksandra, Justyna, Sylwia, Karolina, Marta',
          'Halina, Krystyna, Danuta, Jadwiga, Wanda, Zofia, Stanisława, Irena, Helena, Genowefa, Czesława, Teresa, Janina, Bożena, Elżbieta',
        ),
        masculine: tiers(
          'Antoni, Jan, Szymon, Filip, Nikodem, Jakub, Ignacy, Aleksander, Franciszek, Leon, Mikołaj, Kacper, Tymon, Wiktor, Igor',
          'Tomasz, Paweł, Marcin, Piotr, Krzysztof, Michał, Łukasz, Grzegorz, Jarosław, Dariusz, Robert, Marek, Artur, Rafał, Wojciech',
          'Stanisław, Zbigniew, Tadeusz, Kazimierz, Bogdan, Józef, Jerzy, Ryszard, Henryk, Zdzisław, Władysław, Czesław, Mieczysław, Edward, Lech',
        ),
        surnames: w(
          'Adamczyk, Dąbrowski, Dudek, Grabowski, Jabłoński, Jankowski, Kaczmarek, Kamiński, Kowalski, Kozłowski, Krawczyk, Król, Kwiatkowski, Lewandowski, Majewski, Mazur, Michalski, Nowak, Nowicki, Olszewski, Pawłowski, Piotrowski, Szymański, Wieczorek, Wiśniewski, Wojciechowski, Woźniak, Wójcik, Zając, Zieliński',
        ),
        femSurname: polishFem,
      },
      {
        origin: 'Czech',
        feminine: tiers(
          'Eliška, Tereza, Natálie, Adéla, Anna, Sofie, Viktorie, Ema, Karolína, Kristýna, Klára, Amálie, Rozálie, Julie, Nela',
          'Petra, Lenka, Jana, Martina, Ivana, Kateřina, Hana, Veronika, Lucie, Markéta, Michaela, Barbora, Zuzana, Monika, Pavla',
          'Božena, Jarmila, Věra, Libuše, Marie, Ludmila, Jiřina, Zdeňka, Vlasta, Milada, Blažena, Drahomíra, Miroslava, Jaroslava, Alena',
        ),
        masculine: tiers(
          'Vojtěch, Matyáš, Jakub, Adam, Tobiáš, Šimon, Matěj, Filip, Kryštof, Antonín, Dominik, Vít, Mikuláš, Daniel, Štěpán',
          'Tomáš, Martin, Petr, Lukáš, Jiří, Pavel, Michal, Jan, David, Radek, Ondřej, Marek, Roman, Aleš, Libor',
          'Jaroslav, Miroslav, Zdeněk, Bohumil, Ladislav, Josef, Václav, Karel, Vladimír, Oldřich, Stanislav, Vlastimil, Bohuslav, Miloš, Jindřich',
        ),
        surnames: w(
          'Bartoš, Beneš, Blažek, Čermák, Černý, Dvořák, Fiala, Hájek, Horák, Jelínek, Kolář, Kovář, Král, Kříž, Kučera, Marek, Navrátil, Němec, Novák, Novotný, Pokorný, Pospíšil, Procházka, Růžička, Sedláček, Svoboda, Urban, Vacek, Veselý, Zeman',
        ),
        femSurname: czechFem,
      },
    ],
  },
  greek: {
    label: 'Greek',
    regions: [
      {
        origin: 'Greek',
        feminine: tiers(
          'Danai, Melina, Rafaela, Myrto, Ariadni, Iliana, Nefeli, Artemis, Faidra, Electra, Zoi, Thaleia, Evelina, Ioanna, Marilena, Anna',
          'Dimitra, Konstantina, Christina, Angeliki, Eirini, Katerina, Alexandra, Evgenia, Athina, Niki, Stella, Marina, Antonia, Vicky, Foteini, Despina',
          'Eleni, Maria, Georgia, Vasiliki, Panagiota, Aikaterini, Sofia, Kalliopi, Stavroula, Paraskevi, Evangelia, Chrysoula, Anastasia, Theodora, Kyriaki, Ourania',
        ),
        masculine: tiers(
          'Angelos, Orestis, Achilleas, Odysseas, Aris, Rafail, Filippos, Iasonas, Leonidas, Stefanos, Marios, Ilias, Pavlos, Alexis, Thanos, Lambros',
          'Alexandros, Nikos, Kostas, Giannis, Dimitris, Petros, Stelios, Thanasis, Manolis, Panos, Sotiris, Vangelis, Lefteris, Antonis, Markos, Andreas',
          'Georgios, Ioannis, Konstantinos, Dimitrios, Nikolaos, Panagiotis, Vasileios, Christos, Athanasios, Michail, Evangelos, Spyridon, Stavros, Theodoros, Charalampos, Apostolos',
        ),
        surnames: w(
          'Alexiou, Angelopoulos, Antoniou, Christodoulou, Dimitriou, Doukas, Galanis, Georgiou, Ioannidis, Karagiannis, Konstantinidis, Kostopoulos, Kyriakou, Lambrakis, Makris, Mavridis, Nikolaidis, Oikonomou, Panagiotopoulos, Papadopoulos, Papageorgiou, Pappas, Raptis, Samaras, Stavropoulos, Theodorou, Vlachos, Zervas',
        ),
        femSurname: greekFem,
      },
    ],
  },
  arabic: {
    label: 'Arabic',
    regions: [
      {
        origin: 'Arabic',
        feminine: tiers(
          'Maryam, Jana, Malak, Layan, Lujain, Sara, Jouri, Lamar, Rahaf, Shahd, Retaj, Aya, Joud, Alma, Mira, Tala, Yara, Lana, Hoor, Talia',
          'Leila, Rania, Hala, Mona, Dina, Nadia, Reem, Huda, Iman, Hanan, Rasha, Ghada, Nour, Maha, Sana, Yasmin, Dalia, Ruba, Lubna, Abeer',
          'Fatima, Aisha, Khadija, Zainab, Amina, Halima, Saida, Zahra, Naima, Samira, Latifa, Rashida, Hayat, Jamila, Nawal, Fawzia, Souad, Badria, Wadad, Najla',
        ),
        masculine: tiers(
          'Adam, Zayd, Hamza, Ali, Ilyas, Rayan, Yassin, Taim, Kenan, Jad, Amir, Idris, Sami, Faris, Mazen, Laith, Hadi, Zain, Ayham, Yamen',
          'Omar, Khaled, Tariq, Walid, Karim, Samir, Hisham, Ziad, Rami, Fadi, Bassam, Nabil, Hani, Imad, Wael, Marwan, Ayman, Majid, Ghassan, Rabih',
          'Mohammed, Ahmed, Mahmoud, Abdullah, Ibrahim, Hassan, Hussein, Mustafa, Saleh, Abdelrahman, Khalil, Youssef, Saeed, Jamal, Fouad, Tawfiq, Nasser, Rashid, Suleiman, Hamdi',
        ),
        surnames: w(
          'Abboud, Al-Amin, Al-Haddad, Awad, Aziz, Bakr, Barakat, Darwish, Farouk, Haddad, Halabi, Hamdan, Hashemi, Jaber, Karam, Khalil, Khoury, Mansour, Masri, Najjar, Nassar, Nasser, Othman, Qasim, Rahman, Rashed, Sabbagh, Saleh, Shami, Taha, Yassin, Zaher',
        ),
      },
    ],
  },
  indian: {
    label: 'Indian',
    regions: [
      {
        origin: 'Indian',
        feminine: tiers(
          'Aanya, Aadhya, Saanvi, Ananya, Diya, Myra, Kiara, Ira, Anika, Pari, Navya, Advika, Avni, Riya, Siya, Ishita, Aarohi, Tara, Meher, Inaya',
          'Priya, Neha, Pooja, Anjali, Kavita, Sunita, Deepa, Swati, Rekha, Meena, Divya, Shweta, Preeti, Nisha, Sonia, Ritu, Archana, Smita, Shalini, Rupa',
          'Kamala, Savitri, Sarla, Shanti, Pushpa, Lakshmi, Kaushalya, Parvati, Sushila, Vimala, Indira, Shakuntala, Usha, Saroj, Leela, Radha, Sudha, Kamini, Pramila, Sarojini',
        ),
        masculine: tiers(
          'Aarav, Vihaan, Vivaan, Aditya, Arjun, Reyansh, Ayaan, Ishaan, Shaurya, Atharv, Kabir, Advik, Dhruv, Rudra, Arnav, Kian, Ansh, Veer, Yuvan, Krish',
          'Rajesh, Sanjay, Amit, Vikram, Rahul, Anil, Sunil, Manoj, Deepak, Ajay, Vijay, Ashok, Rakesh, Sandeep, Arun, Nitin, Rohit, Vivek, Sameer, Gaurav',
          'Ramesh, Suresh, Mahesh, Krishna, Gopal, Mohan, Shankar, Prakash, Hari, Ramchandra, Narayan, Om Prakash, Bhagwan, Shyam, Jagdish, Madan, Vishnu, Govind, Balram, Dinesh',
        ),
        surnames: w(
          'Agarwal, Banerjee, Bhatia, Bose, Chatterjee, Chopra, Das, Desai, Deshpande, Ghosh, Gupta, Hegde, Iyer, Joshi, Kapoor, Khanna, Krishnan, Kulkarni, Malhotra, Mehta, Menon, Mishra, Mukherjee, Naidu, Nair, Pandey, Patel, Pillai, Rao, Reddy, Saxena, Sen, Shah, Sharma, Shetty, Singh, Srivastava, Subramanian, Verma',
        ),
      },
    ],
  },
  chinese: {
    label: 'Chinese',
    regions: [
      {
        origin: 'Chinese',
        feminine: tiers(
          'Zihan, Yutong, Xinyi, Yixuan, Ruoxi, Yuxi, Zixuan, Shiyu, Keyi, Mengyao, Yinuo, Xinran, Siqi, Jiaxin, Ruolan, Anqi, Muxi, Qingyu, Wanqing, Xinyue',
          'Jing, Yan, Hong, Hui, Min, Juan, Ping, Xiaoling, Lihua, Hongmei, Yanping, Xiaoyan, Lijuan, Ying, Fang, Lina, Dan, Qian, Xiaohong, Yun',
          'Shuzhen, Guiying, Xiuying, Yulan, Guilan, Fengying, Shulan, Xiulan, Cuiying, Yuzhen, Lanying, Suzhen, Jinfeng, Meiying, Huifang, Aihua, Guizhi, Xiuzhen, Shufen, Yumei',
        ),
        masculine: tiers(
          'Haoran, Yuxuan, Zihao, Yichen, Junjie, Zimo, Muchen, Haoyu, Ziyang, Yize, Jinghan, Ruize, Chenxi, Yifan, Zhiyuan, Tianyi, Boyu, Shengrui, Mingze, Yuheng',
          'Wei, Lei, Jun, Tao, Gang, Jie, Peng, Hao, Bin, Qiang, Chao, Yong, Feng, Ming, Dong, Xiaodong, Haitao, Liang, Kai, Bo',
          'Jianguo, Guoqiang, Zhiqiang, Jianhua, Jianjun, Weiguo, Deming, Guohua, Zhenhua, Yongqiang, Fuqiang, Baoguo, Zhengang, Xueming, Jinlong, Guangming, Shuming, Wenbin, Changsheng, Youcai',
        ),
        surnames: w(
          'Bai, Cai, Cao, Chen, Cheng, Deng, Ding, Dong, Du, Fang, Feng, Gao, Guo, Han, He, Hu, Huang, Jiang, Li, Liang, Lin, Liu, Lu, Luo, Ma, Pan, Peng, Qin, Ren, Shen, Song, Su, Sun, Tang, Tian, Wang, Wei, Wu, Xiao, Xie, Xu, Yang, Yao, Ye, Yu, Yuan, Zeng, Zhang, Zhao, Zheng, Zhou, Zhu',
        ),
      },
    ],
  },
  japanese: {
    label: 'Japanese',
    regions: [
      {
        origin: 'Japanese',
        feminine: tiers(
          'Himari, Yui, Mei, Tsumugi, Rin, Akari, Sakura, Hina, Mio, Yuna, Aoi, Kaede, Hana, Ichika, Riko, Koharu, Mitsuki, Hinata, Kanon, Saki',
          'Yumi, Megumi, Kumiko, Naoko, Tomoko, Ayumi, Mayumi, Akemi, Junko, Kaori, Yuka, Mika, Rie, Aya, Emi, Sayaka, Ai, Asami, Noriko, Miho',
          'Kazuko, Yoshiko, Sachiko, Michiko, Keiko, Fumiko, Hiroko, Setsuko, Toshiko, Kiyoko, Masako, Yoko, Chiyo, Haruko, Emiko, Teruko, Sumiko, Fusako, Hatsue, Shizuko',
        ),
        masculine: tiers(
          'Haruto, Sota, Yuto, Minato, Riku, Ren, Itsuki, Asahi, Yamato, Hayato, Haruki, Sora, Kaito, Daiki, Takumi, Yuma, Ritsu, Sosuke, Aoto, Hinata',
          'Daisuke, Takuya, Kenji, Shinji, Makoto, Yusuke, Kazuya, Naoki, Satoshi, Tetsuya, Hideki, Masaki, Shota, Ryo, Kohei, Takashi, Atsushi, Junichi, Yuji, Tomoya',
          'Hiroshi, Takeshi, Kiyoshi, Isamu, Minoru, Shigeru, Osamu, Tadashi, Yoshio, Akira, Katsumi, Noboru, Masao, Haruo, Tsutomu, Toshio, Saburo, Ichiro, Shoji, Mitsuo',
        ),
        surnames: w(
          'Aoki, Endo, Fujii, Fujita, Hashimoto, Hayashi, Ikeda, Inoue, Ishikawa, Ito, Kato, Kimura, Kobayashi, Kondo, Maeda, Matsumoto, Mori, Murakami, Nakamura, Nishimura, Ogawa, Okada, Sakamoto, Sasaki, Sato, Shimizu, Suzuki, Takahashi, Takeda, Tanaka, Watanabe, Yamada, Yamaguchi, Yamamoto, Yoshida',
        ),
      },
    ],
  },
  korean: {
    label: 'Korean',
    regions: [
      {
        origin: 'Korean',
        feminine: tiers(
          'Seo-yeon, Ha-eun, Ji-woo, Seo-yoon, Min-seo, Ha-yoon, Ji-a, Su-ah, Yu-na, Chae-won, Da-eun, Ye-eun, Si-a, Ah-rin, Yoon-seo, Ha-rin, Seo-ah, Ga-eun, Chae-eun, Na-yeon',
          'Ji-young, Mi-kyung, Hye-jin, Eun-jung, Sun-young, Ji-hye, Soo-jin, Hyun-joo, Min-jung, Yoon-hee, Eun-young, Jin-hee, Mi-young, Ji-eun, Yu-jin, Hye-won, So-young, Eun-hee, Jung-eun, Mi-ra',
          'Young-ja, Soon-ja, Jeong-ja, Ok-soon, Mal-soon, Kyung-ja, Myung-ja, Jeong-sook, Young-sook, Soon-ok, Bok-soon, Geum-ja, Hwa-ja, Chun-ja, Yeong-hee, Kyung-sook, Mi-ja, Sun-hee, Ok-ja, Soon-hee',
        ),
        masculine: tiers(
          'Min-jun, Seo-jun, Do-yun, Ha-jun, Si-woo, Ju-won, Ye-jun, Ji-ho, Eun-woo, Yu-jun, Gun-woo, Ji-hwan, Si-hoo, Do-hyun, Joon-young, Woo-hyun, Jae-yoon, Yi-jun, Ha-min, Seo-woo',
          'Ji-hoon, Sung-min, Hyun-woo, Jun-ho, Dong-hyun, Jae-won, Sang-woo, Min-ho, Seung-hyun, Jin-woo, Kyung-ho, Tae-hoon, Jung-hoon, Young-jin, Hyun-jun, Sung-hoon, Dae-sung, Woo-jin, Jae-hyun, Seung-woo',
          'Young-ho, Young-soo, Jung-soo, Sang-chul, Kwang-soo, Byung-chul, Jong-sik, Man-soo, Yong-ho, Dong-soo, Chang-ho, Kyung-soo, Jae-chul, Myung-soo, Sung-soo, Jong-ho, Won-sik, Chul-soo, Ki-young, Bong-soo',
        ),
        surnames: w(
          'Ahn, Bae, Baek, Cha, Cho, Choi, Ha, Han, Heo, Hong, Hwang, Jang, Jeon, Joo, Jung, Kang, Kim, Ko, Kwak, Kwon, Lee, Lim, Min, Moon, Na, Nam, Noh, Oh, Park, Ryu, Seo, Shim, Shin, Son, Song, Sung, Woo, Yang, Yoo, Yoon',
        ),
      },
    ],
  },
};

/** All styles in menu order, with their labels. */
export const NAME_STYLE_LABELS: [NameStyle, string][] = [
  ...(Object.entries(NAME_STYLES) as [Exclude<NameStyle, 'fantasy'>, StyleData][]).map(([k, v]) => [k, v.label] as [NameStyle, string]),
  ['fantasy', 'Fantasy (invented)'],
];

export const NAME_AGE_LABELS: Record<NameAge, string> = {
  any: 'Any age',
  child: 'Child or teen',
  young: 'Young adult',
  middle: 'Middle-aged',
  elderly: 'Elderly',
};

/** How likely each generation of names is for an age. */
const AGE_WEIGHTS: Record<NameAge, Record<Tier, number>> = {
  any: { young: 1, adult: 1, old: 1 },
  child: { young: 1, adult: 0, old: 0 },
  young: { young: 0.65, adult: 0.35, old: 0 },
  middle: { young: 0, adult: 0.85, old: 0.15 },
  elderly: { young: 0, adult: 0.1, old: 0.9 },
};

// ── Fantasy: invented names from syllables ──────────────────────────────
const FANTASY = {
  start: w('Ae, Al, Bel, Bran, Cor, Cael, Dra, Dun, El, Ery, Fen, Fae, Gal, Gwen, Hal, Ith, Isil, Jor, Kae, Kel, Lor, Lys, Mor, Mael, Nym, Nar, Or, Os, Quel, Ryn, Rhae, Sar, Sil, Thal, Tor, Ul, Vey, Val, Wyn, Xan, Yse, Zar'),
  mid: w('a, e, i, o, ae, ia, or, an, el, is, yr, un, ad, en, il, ar, eth, ori'),
  endF: w('a, ia, iel, wen, ra, lyn, eth, is, ae, ine, ys, wyn, enna, ith, ara, elle, ira'),
  endM: w('or, an, ius, ric, dor, mir, oth, en, ar, ion, as, ek, ul, rath, is, wyn, gar, thas'),
  surnameA: w('Storm, Ash, Raven, Iron, Silver, Thorn, Night, Ember, Frost, Gold, Dusk, Oak, Wolf, Grey, Black, Bright, Moon, Star, Stone, Red, Hollow, Briar, Cinder, Winter'),
  surnameB: w('vale, wood, crest, brook, fall, hart, shade, wind, forge, mere, bane, field, ward, holt, more, ridge, song, helm, water, wick, bourne, fell'),
};

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/** Picks from `arr`, preferring items not in `avoid`. */
function pickFresh(arr: string[], rnd: () => number, avoid: Set<string>): string {
  for (let i = 0; i < 12; i++) {
    const x = pick(arr, rnd);
    if (!avoid.has(x)) return x;
  }
  const fresh = arr.filter((x) => !avoid.has(x));
  return fresh.length ? pick(fresh, rnd) : pick(arr, rnd);
}

function pickTier(age: NameAge, rnd: () => number): Tier {
  const wts = AGE_WEIGHTS[age];
  const total = wts.young + wts.adult + wts.old;
  let r = rnd() * total;
  for (const t of ['young', 'adult', 'old'] as Tier[]) {
    if ((r -= wts[t]) < 0) return t;
  }
  return 'adult';
}

/** Rejects clumsy syllable joins: three vowels in a row, a repeated syllable ("Jororor"), doubled vowels. */
const awkward = (s: string) => /[aeiouy]{3}/i.test(s) || /(\w\w)\1/i.test(s) || /([aeiouy])\1/i.test(s);

/** Builds a name from syllables, retrying until it reads smoothly. */
function smooth(build: () => string, maxLen = 11): string {
  let s = build();
  for (let i = 0; i < 20 && (awkward(s) || s.length > maxLen); i++) s = build();
  return s;
}

/** Younger fantasy names are short; older ones have more syllables. */
function fantasyFirst(g: 'feminine' | 'masculine', tier: Tier, rnd: () => number) {
  return smooth(() => {
    const mids = tier === 'young' ? (rnd() < 0.2 ? 1 : 0) : tier === 'adult' ? (rnd() < 0.55 ? 1 : 0) : rnd() < 0.3 ? 2 : 1;
    let s = pick(FANTASY.start, rnd);
    for (let i = 0; i < mids; i++) s += pick(FANTASY.mid, rnd);
    return s + pick(g === 'feminine' ? FANTASY.endF : FANTASY.endM, rnd);
  });
}

function fantasySurname(rnd: () => number) {
  if (rnd() < 0.75) return pick(FANTASY.surnameA, rnd) + pick(FANTASY.surnameB, rnd);
  // Some houses have an invented name instead of a word name.
  return smooth(() => pick(FANTASY.start, rnd) + pick(FANTASY.mid, rnd) + pick(['ane', 'eth', 'oran', 'ys', 'ell', 'ari', 'ond', 'ira'], rnd));
}

export interface GeneratedName {
  name: string;
  first: string;
  surname: string;
  /** Country of origin, for styles that mix several. */
  origin: string;
}

export interface NameOptions {
  style: NameStyle;
  gender?: NameGender;
  age?: NameAge;
  count?: number;
  rnd?: () => number;
  /**
   * First names and surnames shown recently, to steer away from (best
   * effort). The names generated are added to it, so passing the same set on
   * every roll keeps successive batches different.
   */
  recent?: Set<string>;
}

/** Generates unique names; no first name or surname repeats within a batch. */
export function generateNameDetails({ style, gender = 'any', age = 'any', count = 12, rnd = Math.random, recent }: NameOptions): GeneratedName[] {
  const out: GeneratedName[] = [];
  const used = new Set<string>(recent);
  const full = new Set<string>();
  let guard = 0;
  while (out.length < count && guard++ < count * 30) {
    const g = gender === 'any' ? (rnd() < 0.5 ? 'feminine' : 'masculine') : gender;
    const tier = pickTier(age, rnd);
    let first: string;
    let surname: string;
    let origin: string;
    if (style === 'fantasy') {
      first = fantasyFirst(g, tier, rnd);
      surname = fantasySurname(rnd);
      origin = 'Fantasy';
      if (used.has(first) || used.has(surname)) continue;
    } else {
      const region = pick(NAME_STYLES[style].regions, rnd);
      origin = region.origin;
      first = pickFresh(region[g][tier], rnd, used);
      surname = pickFresh(region.surnames, rnd, used);
      if (region.doubleSurname && rnd() < region.doubleSurname) {
        const second = pickFresh(region.surnames.filter((s) => s !== surname), rnd, used);
        surname = `${surname} ${second}`;
      }
      // Remember the base form too, so Petrov and Petrova don't both appear.
      for (const part of surname.split(' ')) used.add(part);
      if (g === 'feminine' && region.femSurname) surname = surname.split(' ').map(region.femSurname).join(' ');
    }
    const name = `${first} ${surname}`;
    if (full.has(name)) continue;
    full.add(name);
    used.add(first);
    used.add(surname);
    for (const part of surname.split(' ')) used.add(part);
    out.push({ name, first, surname, origin });
  }
  if (recent) {
    for (const n of out) {
      recent.add(n.first);
      recent.add(n.surname);
    }
    // Remember roughly the last two batches.
    const limit = count * 4;
    for (const x of recent) {
      if (recent.size <= limit) break;
      recent.delete(x);
    }
  }
  return out;
}

/** Generates `count` unique full names. */
export function generateNames(style: NameStyle, gender: NameGender, count = 12, rnd: () => number = Math.random, age: NameAge = 'any'): string[] {
  return generateNameDetails({ style, gender, age, count, rnd }).map((n) => n.name);
}
