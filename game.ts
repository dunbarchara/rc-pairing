import * as readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import * as fs from 'fs';
import * as path from 'path';

import { execSync } from 'child_process';

function nodeSyncSleep(ms: number): void {
    execSync(`node -e "setTimeout(() => {}, ${ms})"`);
}

declare const process: any; // clear red squiggle on process references, we're running ts file directly node v24 so just cosmetic in editor

/*
=================================================================================

    CLASS DEFS: Game, Asset, Canvas
    
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

class Game {
    map: string[][]; // game of game represented by chars
    availableSpaces: boolean[][];
    viewboxRows: number; // sizing for viewbox
    viewboxCols: number; // sizing for viewbox
    renderRowOffset: number; // for convenience, half the size of viewbox
    renderColOffset: number; // for convenience, half the size of viewbox
    characterPosition: Position;
    zombiePositions: Position[];
    logStatement: string = '';
    gameOver: boolean = false;
    gameWon: boolean = false;

    constructor(rows: number, cols: number, viewboxRows: number, viewboxCols: number) {
        this.map = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ' ')); // init empty game of spaces
        this.availableSpaces = Array.from({ length: rows }, () => Array.from({ length: cols }, () => true));

        for (let i = 0; i < this.map.length; i++) {
            for (let j = 0; j < this.map[0].length; j++) {
                if (i === 0 ||
                    i === this.map.length - 1 ||
                    j === 0 ||
                    j === this.map[0].length - 1
                ) {
                    this.map[i][j] = '#'; // init game border of '#'
                    this.availableSpaces[i][j] = false;
                }
            }
        }

        this.viewboxRows = viewboxRows;
        this.viewboxCols = viewboxCols;
        this.renderRowOffset = Math.floor(this.viewboxRows / 2);
        this.renderColOffset = Math.floor(this.viewboxCols / 2);
        this.characterPosition = { row: Math.floor(this.map.length / 2), col: Math.floor(this.map[0].length / 2) };
        this.availableSpaces[this.characterPosition.row][this.characterPosition.col] = false;
        this.zombiePositions = [];
    }

    addAsset(asset: Asset, position: Position) {
        // place the asset at the specified position by copying its contents into the game[][] def
        // position is top left anchor
        for (let i = 0; i < asset.asset.length; i++) {
            for (let j = 0; j < asset.asset[0].length; j++) {
                if ((position.row + i) < 0 || (position.row + i) >= this.map.length ||
                    (position.col + j) < 0 || (position.col + j) >= this.map[0].length) {
                    // out of game[][] bounds, throw error, only support full asset in bounds
                    throw `ERROR: addAsset — invalid asset position ${asset.assetPath} ROW: ${position.row + i} COL: ${position.col + j}`;
                }

                this.map[position.row + i][position.col + j] = asset.asset[i][j];
                this.availableSpaces[position.row + i][position.col + j] = false;
            }
        }
    }

    renderViewbox(): string {
        // return a string rendering of the game that fits within the viewbox centered around the specified position

        const startRow = this.characterPosition.row - this.renderRowOffset; // row pos that starts viewbox
        const startCol = this.characterPosition.col - this.renderColOffset; // col pos that starts the viewbox

        let renderBox = '_'.repeat(this.viewboxCols + 2) + '\n'; // upper viewbox border

        for (let i = startRow; i < startRow + this.viewboxRows; i++) {
            renderBox += '|'; // lefthand viewbox border
            for (let j = startCol; j < startCol + this.viewboxCols; j++) {
                if (i === this.characterPosition.row && j === this.characterPosition.col) {
                    renderBox += this.gameOver ? 'Z' : 'C'; // render the 'character' in center of viewbox, or 'Z' if gameover
                } else if (i < 0 || i >= this.map.length || j < 0 || j >= this.map[0].length) {
                    // out of bounds, render empty space
                    renderBox += ' ';
                } else {
                    // in bounds, render the game
                    renderBox += this.map[i][j];
                }
            }
            renderBox += '|\n' // righthand viewbox border
        }

        // lower viewbox border
        renderBox += '—'.repeat(this.viewboxCols + 2);

        return renderBox;
    }

    canMove(position: Position): boolean {
        this.logStatement = `trying to move ${position.row}, ${position.col} -> ${this.map[position.row][position.col] === ' '}`;
        return this.map[position.row][position.col] === ' ';

    }

    spawnZombies(num: number) {
        for (let i = 0; i < num; i++) {
            // for each zombie

            let pos = this.getRandomPosition();
            while (this.availableSpaces[pos.row][pos.col] === false) {
                pos = this.getRandomPosition();
            }

            this.zombiePositions.push(pos);
            this.map[pos.row][pos.col] = 'Z';
            this.availableSpaces[pos.row][pos.col] = false;
        }
    }

    getRandomPosition(): Position {
        return { row: Math.floor(Math.random() * this.availableSpaces.length), col: Math.floor(Math.random() * this.availableSpaces[0].length) };
    }

    iterateZombies() {
        for (let i = 0; i < this.zombiePositions.length; i++) {
            // Zombie logic is not intelligent, they will simply check WASD directions and pick the first one
            // that is a movable space closer to the player position
            // no path finding, so zombies can definitely get stuck on the opposite sides of structures

            const zPos = this.zombiePositions[i];

            let newPos: Position = { row: zPos.row, col: zPos.col };

            if (zPos.row > this.characterPosition.row &&
                this.canMove(this.getNewPosition('w', zPos))) {
                // move up
                newPos = this.getNewPosition('w', zPos);
            } else if (zPos.col > this.characterPosition.col &&
                this.canMove(this.getNewPosition('a', zPos))) {
                // move left
                newPos = this.getNewPosition('a', zPos);
            } else if (zPos.row < this.characterPosition.row &&
                this.canMove(this.getNewPosition('s', zPos))) {
                // move down
                newPos = this.getNewPosition('s', zPos);
            } else if (zPos.col < this.characterPosition.col &&
                this.canMove(this.getNewPosition('d', zPos))) {
                // move right
                newPos = this.getNewPosition('d', zPos);
            }


            this.map[zPos.row][zPos.col] = ' '; // free up
            this.map[newPos.row][newPos.col] = 'Z'; // free up
            this.zombiePositions[i] = newPos;

            // check if game over
            if (newPos.row === this.characterPosition.row && newPos.col === this.characterPosition.col) {
                this.gameOver = true;
                return;
            }
        }
    }

    getNewPosition(direction: string, startPos: Position): Position {
        // given a star position and a direction, return the Position that represents a move in that direction
        let rowInc = 0;
        let colInc = 0;
        switch (direction) {
            case 'w':
                rowInc = -1;
                break;
            case 'a':
                colInc = -1;
                break;
            case 's':
                rowInc = 1;
                break;
            case 'd':
                colInc = 1;
                break;
            default:
                throw 'Invalid move input';
        }

        return { row: startPos.row + rowInc, col: startPos.col + colInc };
    }

    tryMoveCharacter(direction: string) {
        // try to move the character in the given direction
        const newPosition = this.getNewPosition(direction, this.characterPosition);

        if (this.canMove(newPosition)) {
            this.characterPosition = newPosition;
        }
    }

    fireBullet(direction: string) {
        // fire a bullet within the view box, render each step until it hits a zombie, wall, or leaves viewbox
        let bulletPosition = this.getNewPosition(direction, this.characterPosition);

        // only shoot within viewbox
        let fireDistance = (direction === 'w' || direction === 's') ? this.renderRowOffset : this.renderColOffset;

        while (this.canMove(bulletPosition) && fireDistance > 0) {
            // paint frame
            this.map[bulletPosition.row][bulletPosition.col] = '*';
            repaintTerminal();
            nodeSyncSleep(50);
            this.map[bulletPosition.row][bulletPosition.col] = ' ';
            bulletPosition = this.getNewPosition(direction, bulletPosition);
            fireDistance--;
        }

        // bullet position is an occupied space, check if zombie
        for (let i = 0; i < this.zombiePositions.length; i++) {
            if (bulletPosition.row === this.zombiePositions[i].row &&
                bulletPosition.col === this.zombiePositions[i].col) {
                // zombie found, remove
                this.map[bulletPosition.row][bulletPosition.col] = ' ';
                this.zombiePositions.splice(i, 1);

                if (this.zombiePositions.length === 0) {
                    this.gameWon = true;
                }
                return;
            }
        }
    }


}










/*
=================================================================================

    MAP INITIALIZATION + Placing Assets
    
=================================================================================
*/

//const game: Game = new Game(50, 150, 55, 200); // large viewbox (debugging)
const game: Game = new Game(50, 150, 15, 40); // standard viewbox

// init assets
const assetChurch: Asset = new Asset('./assets/building_church.txt');
const assetHouse: Asset = new Asset('./assets/building_house.txt');
const assetLighthouse: Asset = new Asset('./assets/building_lighthouse.txt');
const assetMansion: Asset = new Asset('./assets/building_mansion.txt');
const assetTotem: Asset = new Asset('./assets/building_totem.txt');
const assetWindmill: Asset = new Asset('./assets/building_windmill.txt');
const assetDuck: Asset = new Asset('./assets/duck.txt');

// place assets
game.addAsset(assetChurch, { row: 23, col: 120 });
game.addAsset(assetHouse, { row: 18, col: 52 });
game.addAsset(assetHouse, { row: 18, col: 86 });
game.addAsset(assetHouse, { row: 28, col: 52 });
game.addAsset(assetHouse, { row: 28, col: 86 });
game.addAsset(assetHouse, { row: 35, col: 115 });
game.addAsset(assetHouse, { row: 28, col: 86 });
game.addAsset(assetMansion, { row: 20, col: 15 });
game.addAsset(assetMansion, { row: 34, col: 18 });
game.addAsset(assetLighthouse, { row: 5, col: 70 });
game.addAsset(assetTotem, { row: 37, col: 60 });
game.addAsset(assetTotem, { row: 37, col: 82 });
game.addAsset(assetWindmill, { row: 3, col: 120 });
game.addAsset(assetDuck, { row: 5, col: 8 });
game.addAsset(assetDuck, { row: 7, col: 18 });
game.addAsset(assetDuck, { row: 2, col: 22 });
game.addAsset(assetDuck, { row: 4, col: 31 });

// spawn zombies
game.spawnZombies(4);










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

let stepCounter = 0;
let keyPressed = '';
let firePhase = false;

// Helper function to wait for a single keypress
function waitForKeypress(): Promise<string> {
    return new Promise((resolve) => {
        const listener = (str: string, key: readline.Key) => {
            // Allow exiting via Ctrl+C
            keyPressed = key.name;
            if (key.ctrl && key.name === 'c') {
                process.exit(0);
            }

            if (!firePhase && key.name === 'f') {
                firePhase = true;
            }

            if (['w', 'a', 's', 'd'].includes(key.name)) {

                if (firePhase) {
                    // fire bullet
                    game.fireBullet(key.name);
                    firePhase = false
                } else {
                    // try movement
                    game.tryMoveCharacter(key.name);
                }

                game.iterateZombies();
            }

            input.removeListener('keypress', listener);
            resolve(str || key.name);
        };
        input.on('keypress', listener);
    });
}

function repaintTerminal() {
    const renderViewBox = game.renderViewbox();
    output.write('\x1b[2J\x1b[0f');

    console.log(`--- ${game.zombiePositions.length} Zombie${game.zombiePositions.length !== 1 ? 's' : ''} Left`);
    console.log(`--- Mode: ${firePhase ? 'Firing Weapon' : 'Walking'}`);
    /*
    console.log(`--- Steps: ${stepCounter} ---`);
    console.log(`--- Key: ${keyPressed} ---`);
    console.log(`--- Size: ${game.map.length} x ${game.map[0].length}`);
    console.log(`--- Position: [${game.characterPosition.row}][${game.characterPosition.col}] ---`);
    */
    console.log(renderViewBox);

    if (!(game.gameOver || game.gameWon)) {
        // game still going
        console.log(`\n--- CONTROLS --------------` + `\n\n  WASD - Movement` + `\n  F - Fire Weapon + WASD` + `\n\n  Ctrl + C - Quit` + `\n___________________________`);

    } else {
        // game ended
        console.log(game.gameWon ? '\n!!! YOU WON !!! (:' : '\n--- GAME OVER :( ---');
    }
}

async function runGame() {

    while (true) {
        repaintTerminal();

        if (!(game.gameOver || game.gameWon)) {
            // game still going
            await waitForKeypress();
            // Iterate step
            stepCounter++;
        } else {
            // game ended
            process.exit(0);
        }
    }
}

runGame().catch((err) => {
    console.error('Error in Game:', err);
    process.exit(1);
});
