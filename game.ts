import * as readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import * as fs from 'fs';
import * as path from 'path';

declare const process: any; // clear red squiggle on process references, we're running ts file directly node v24 so just cosmetic in editor

/*
=================================================================================

    CLASS DEFS: Map, Asset, Canvas
    
=================================================================================
*/

type Position = { row: number; col: number };

class Asset {
    assetPath: string;
    asset: string[][];

    constructor(assetPath: string) {
        this.assetPath = assetPath;
        this.asset = Asset.readTxtAs2DCharArray(this.assetPath);
    }

    static readTxtAs2DCharArray(filePath: string): string[][] {
        const fileContent: string = fs.readFileSync(filePath, 'utf-8');

        // split into rows by both (\r\n) and (\n) line endings and filter trailing empty lines
        const lines: string[] = fileContent.split(/\r?\n/).filter(line => line.length > 0);

        // convert each line into array of characters
        const grid: string[][] = lines.map(line => line.split(''));

        return grid;
    }
}

class Map {
    map: string[][]; // map of game represented by chars
    viewboxRows: number; // sizing for viewbox
    viewboxCols: number; // sizing for viewbox
    renderRowOffset: number; // for convenience, half the size of viewbox
    renderColOffset: number; // for convenience, half the size of viewbox

    constructor(rows: number, cols: number, viewboxRows: number, viewboxCols: number) {
        this.map = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ' ')); // init empty map of spaces
        for (let i = 0; i < this.map.length; i++) {
            for (let j = 0; j < this.map[0].length; j++) {
                if (i === 0 ||
                    i === this.map.length - 1 ||
                    j === 0 ||
                    j === this.map[0].length - 1
                ) {
                    this.map[i][j] = '#'; // init map border of '#'
                }
            }
        }

        this.viewboxRows = viewboxRows;
        this.viewboxCols = viewboxCols;
        this.renderRowOffset = Math.floor(this.viewboxRows / 2);
        this.renderColOffset = Math.floor(this.viewboxCols / 2);
    }

    addAsset(asset: Asset, position: Position) {
        // place the asset at the specified position by copying its contents into the map[][] def
        // position is top left anchor
        for (let i = 0; i < asset.asset.length; i++) {
            for (let j = 0; j < asset.asset[0].length; j++) {
                if ((position.row + i) < 0 || (position.row + i) >= this.map.length ||
                    (position.col + j) < 0 || (position.col + j) >= this.map[0].length) {
                    // out of map[][] bounds, throw error, only support full asset in bounds
                    throw `ERROR: addAsset — invalid asset position ${asset.assetPath} ROW: ${position.row + i} COL: ${position.col + j}`;
                }

                this.map[position.row + i][position.col + j] = asset.asset[i][j];
            }
        }
    }

    renderViewbox(position: Position): string {
        // return a string rendering of the map that fits within the viewbox centered around the specified position

        const startRow = position.row - this.renderRowOffset; // row pos that starts viewbox
        const startCol = position.col - this.renderColOffset; // col pos that starts the viewbox

        let renderBox = '_'.repeat(this.viewboxCols + 2) + '\n'; // upper viewbox border

        for (let i = startRow; i < startRow + this.viewboxRows; i++) {
            renderBox += '|'; // lefthand viewbox border
            for (let j = startCol; j < startCol + this.viewboxCols; j++) {
                if (i === position.row && j === position.col) {
                    renderBox += 'C'; // render the 'character' in center of viewbox
                } else if (i < 0 || i >= this.map.length || j < 0 || j >= this.map[0].length) {
                    // out of bounds, render empty space
                    renderBox += ' ';
                } else {
                    // in bounds, render the map
                    renderBox += this.map[i][j];
                }
            }
            renderBox += '|\n' // righthand viewbox border
        }

        // lower viewbox border
        renderBox += '—'.repeat(this.viewboxCols + 2);

        return renderBox;
    }
}










/*
=================================================================================

    MAP INITIALIZATION + Placing Assets
    
=================================================================================
*/

//const map: Map = new Map(50, 150, 55, 200); // large viewbox (debugging)
const map: Map = new Map(50, 150, 15, 40); // standard viewbox

// init assets
const assetChurch: Asset = new Asset('./assets/building_church.txt');
const assetHouse: Asset = new Asset('./assets/building_house.txt');
const assetLighthouse: Asset = new Asset('./assets/building_lighthouse.txt');
const assetMansion: Asset = new Asset('./assets/building_mansion.txt');
const assetTotem: Asset = new Asset('./assets/building_totem.txt');
const assetWindmill: Asset = new Asset('./assets/building_windmill.txt');
const assetDuck: Asset = new Asset('./assets/duck.txt');

// place assets
map.addAsset(assetChurch, { row: 23, col: 120 });
map.addAsset(assetHouse, { row: 18, col: 52 });
map.addAsset(assetHouse, { row: 18, col: 86 });
map.addAsset(assetHouse, { row: 28, col: 52 });
map.addAsset(assetHouse, { row: 28, col: 86 });
map.addAsset(assetHouse, { row: 35, col: 115 });
map.addAsset(assetHouse, { row: 28, col: 86 });
map.addAsset(assetMansion, { row: 20, col: 15 });
map.addAsset(assetMansion, { row: 34, col: 18 });
map.addAsset(assetLighthouse, { row: 5, col: 70 });
map.addAsset(assetTotem, { row: 37, col: 60 });
map.addAsset(assetTotem, { row: 37, col: 82 });
map.addAsset(assetWindmill, { row: 3, col: 120 });
map.addAsset(assetDuck, { row: 5, col: 8 });
map.addAsset(assetDuck, { row: 7, col: 18 });
map.addAsset(assetDuck, { row: 2, col: 22 });
map.addAsset(assetDuck, { row: 4, col: 31 });

// init character starting position in middle of the map
let characterPosition: Position = { row: Math.floor(map.map.length / 2), col: Math.floor(map.map[0].length / 2) };










/*
=================================================================================

    GAME ORCHESTRATION and user input
    
=================================================================================
*/

// Enable single keypress events from standard input
readline.emitKeypressEvents(input);
if (input.isTTY) {
    input.setRawMode(true);
}

let keyPressed = '';

// Helper function to wait for a single keypress
function waitForKeypress(): Promise<string> {
    return new Promise((resolve) => {
        const listener = (str: string, key: readline.Key) => {
            // Allow exiting via Ctrl+C
            if (key.ctrl && key.name === 'c') {
                process.exit(0);
            }
            switch (key.name) {
                case 'w':
                    keyPressed = 'w';
                    characterPosition.row -= 1;
                    break;
                case 'a':
                    keyPressed = 'a';
                    characterPosition.col -= 1;
                    break;
                case 's':
                    keyPressed = 's';
                    characterPosition.row += 1;
                    break;
                case 'd':
                    keyPressed = 'd';
                    characterPosition.col += 1;
                    break;
                default:
                    break;
            }
            input.removeListener('keypress', listener);
            resolve(str || key.name);
        };
        input.on('keypress', listener);
    });
}

async function runGame() {
    let counter = 0;

    while (true) {
        // Clear screen and move cursor to top-left
        const renderViewBox = map.renderViewbox(characterPosition);
        output.write('\x1b[2J\x1b[0f');

        console.log(`--- Steps: ${counter} ---`);
        console.log(`--- Key: ${keyPressed} ---`);
        console.log(`--- Size: ${map.map.length} x ${map.map[0].length}`);
        console.log(`--- Position: [${characterPosition.row}][${characterPosition.col}] ---`);
        console.log(renderViewBox);

        console.log('\nWASD to move (or Ctrl+C to exit)...');

        // Wait for keypress commands
        await waitForKeypress();

        // Iterate step
        counter++;
    }
}

runGame().catch((err) => {
    console.error('Error in Game:', err);
    process.exit(1);
});
