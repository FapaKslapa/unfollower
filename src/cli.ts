import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import boxen from "boxen";
import Table from "cli-table";
import dotenv from "dotenv";
import figlet from "figlet";
import inquirer from "inquirer";
import { IgApiClient } from "instagram-private-api";
import ora from "ora";
import { getAllItemsFromFeed, sleep, unfollowUser } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

interface Credentials {
	username: string;
	password: string;
}

const colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	magenta: "\x1b[35m",
};

async function main() {
	console.clear();
	console.log(
		colors.cyan +
			figlet.textSync("Instagram Unfollower", {
				font: "Standard",
				horizontalLayout: "default",
				verticalLayout: "default",
			}) +
			colors.reset,
	);

	console.log(
		boxen(
			`${colors.bright}Instagram Unfollower Tool${colors.reset}\n` +
				`${colors.yellow}Versione: 1.0.0${colors.reset}\n` +
				`${colors.magenta}Una CLI per gestire chi non ti segue su Instagram${colors.reset}`,
			{
				padding: 1,
				margin: 1,
				borderStyle: "round",
				borderColor: "cyan",
			},
		),
	);

	const credentials = getCredentials();

	if (!credentials.username || !credentials.password) {
		const answers = await inquirer.prompt([
			{
				type: "input",
				name: "username",
				message: "Inserisci il tuo username Instagram:",
				when: !credentials.username,
				validate: (input) => input.length > 0 || "Username richiesto",
			},
			{
				type: "password",
				name: "password",
				message: "Inserisci la tua password Instagram:",
				when: !credentials.password,
				validate: (input) => input.length > 0 || "Password richiesta",
				mask: "*",
			},
		]);

		credentials.username = answers.username || credentials.username;
		credentials.password = answers.password || credentials.password;

		const { salvaCredenziali } = await inquirer.prompt([
			{
				type: "confirm",
				name: "salvaCredenziali",
				message: "Vuoi salvare queste credenziali nel file .env?",
				default: false,
			},
		]);

		if (salvaCredenziali) {
			salvaCredenzialiSuEnv(credentials);
		}
	}

	const { maxUsersToUnfollow } = await inquirer.prompt([
		{
			type: "number",
			name: "maxUsersToUnfollow",
			message: "Numero massimo di utenti da smettere di seguire:",
			default: parseInt(process.env.MAX_USERS_TO_UNFOLLOW || "100", 10),
			validate: (input) =>
				(input !== undefined && Number.isInteger(input) && input > 0) ||
				"Inserisci un numero valido",
		},
	]);

	const spinnerLogin = ora("Accesso a Instagram in corso...").start();

	try {
		const ig = new IgApiClient();
		ig.state.generateDevice(credentials.username);
		await ig.account.login(credentials.username, credentials.password);
		spinnerLogin.succeed("Accesso riuscito! 🎉");

		const spinnerFetch = ora(
			"Recupero liste di followers e following...",
		).start();
		const followersFeed = ig.feed.accountFollowers(ig.state.cookieUserId);
		const followingFeed = ig.feed.accountFollowing(ig.state.cookieUserId);

		const followers = await getAllItemsFromFeed(followersFeed);
		const following = await getAllItemsFromFeed(followingFeed);

		spinnerFetch.succeed(
			`Recupero completato: ${followers.length} follower, ${following.length} following`,
		);

		const followersUsername = new Set(followers.map((user) => user.username));
		const notFollowingYou = following.filter(
			(user) => !followersUsername.has(user.username),
		);

		console.log(
			boxen(
				`${colors.bright}Statistiche Account${colors.reset}\n` +
					`${colors.cyan}Follower: ${colors.reset}${followers.length}\n` +
					`${colors.cyan}Following: ${colors.reset}${following.length}\n` +
					`${colors.yellow}Utenti che non ti seguono: ${colors.reset}${notFollowingYou.length}`,
				{
					padding: 1,
					margin: 1,
					borderStyle: "round",
					borderColor: "yellow",
				},
			),
		);

		if (notFollowingYou.length === 0) {
			console.log(
				boxen(
					`${colors.green}Ottimo! Tutti gli utenti che segui ti seguono.${colors.reset}`,
					{
						padding: 1,
						margin: 1,
						borderStyle: "round",
						borderColor: "green",
					},
				),
			);
			return;
		}

		const table = new Table({
			head: ["#", "Username", "Nome completo"],
			colWidths: [5, 25, 30],
			style: { head: ["cyan"] },
		});

		notFollowingYou.slice(0, 20).forEach((user, index) => {
			table.push([
				(index + 1).toString(),
				user.username,
				user.full_name || "N/D",
			]);
		});

		console.log("\nUtenti che non ti seguono (primi 20):");
		console.log(table.toString());

		if (notFollowingYou.length > 20) {
			console.log(`...e altri ${notFollowingYou.length - 20} utenti\n`);
		}

		const { confermaUnfollow } = await inquirer.prompt([
			{
				type: "confirm",
				name: "confermaUnfollow",
				message: `Vuoi smettere di seguire ${Math.min(
					maxUsersToUnfollow,
					notFollowingYou.length,
				)} utenti che non ti seguono?`,
				default: false,
			},
		]);

		if (!confermaUnfollow) {
			console.log(
				boxen("Operazione annullata dall'utente.", {
					padding: 1,
					margin: 1,
					borderStyle: "round",
					borderColor: "yellow",
				}),
			);
			return;
		}

		const usersToProcess = notFollowingYou.slice(0, maxUsersToUnfollow);
		console.log(
			`\nProcesso di unfollow avviato per ${usersToProcess.length} utenti`,
		);

		let successCount = 0;

		for (const [index, user] of usersToProcess.entries()) {
			const spinner = ora(
				`Unfollow ${index + 1}/${usersToProcess.length}: @${user.username}`,
			).start();

			const success = await unfollowUser(ig, user);

			if (success) {
				successCount++;
				spinner.succeed(`Unfollow completato: @${user.username}`);
			} else {
				spinner.fail(`Unfollow fallito: @${user.username}`);
			}

			if (index < usersToProcess.length - 1) {
				const waitTime = 5000 + Math.random() * 5000;
				const waitSpinner = ora(
					`Attendo ${Math.round(waitTime / 1000)}s per evitare limiti di richieste...`,
				).start();
				await sleep(waitTime);
				waitSpinner.stop();
			}
		}

		console.log(
			boxen(
				`${colors.bright}Operazione Completata${colors.reset}\n` +
					`${colors.green}Unfollow completati: ${colors.reset}${successCount}\n` +
					`${colors.red}Unfollow falliti: ${colors.reset}${usersToProcess.length - successCount}`,
				{
					padding: 1,
					margin: 1,
					borderStyle: "round",
					borderColor: "green",
				},
			),
		);
	} catch (error) {
		spinnerLogin.fail("Errore durante l'accesso");
		gestisciErrore(error);
	}
}

function getCredentials() {
	return {
		username: process.env.IG_USERNAME || "",
		password: process.env.IG_PASSWORD || "",
	};
}

function salvaCredenzialiSuEnv(credentials: Credentials) {
	try {
		const envPath = path.join(__dirname, "..", ".env");
		let envContent = "";

		if (fs.existsSync(envPath)) {
			envContent = fs.readFileSync(envPath, "utf8");
		}

		const envLines = envContent.split("\n");
		let usernameUpdated = false;
		let passwordUpdated = false;

		for (let i = 0; i < envLines.length; i++) {
			if (envLines[i].startsWith("IG_USERNAME=")) {
				envLines[i] = `IG_USERNAME=${credentials.username}`;
				usernameUpdated = true;
			} else if (envLines[i].startsWith("IG_PASSWORD=")) {
				envLines[i] = `IG_PASSWORD=${credentials.password}`;
				passwordUpdated = true;
			}
		}

		if (!usernameUpdated) {
			envLines.push(`IG_USERNAME=${credentials.username}`);
		}
		if (!passwordUpdated) {
			envLines.push(`IG_PASSWORD=${credentials.password}`);
		}

		fs.writeFileSync(envPath, envLines.join("\n"));
		console.log("Credenziali salvate con successo nel file .env");
	} catch (error) {
		console.error("Errore nel salvare le credenziali:", error);
	}
}

function gestisciErrore(error: unknown) {
	const errorBox = boxen(
		`${colors.red}${colors.bright}Errore${colors.reset}\n` +
			`${error instanceof Error ? error.message : "Errore sconosciuto"}`,
		{
			padding: 1,
			margin: 1,
			borderStyle: "round",
			borderColor: "red",
		},
	);

	console.error(errorBox);

	if (error instanceof Error) {
		if (error.message.includes("challenge_required")) {
			console.log(
				"Instagram richiede una verifica aggiuntiva. Accedi manualmente a Instagram prima.",
			);
		} else if (error.message.includes("checkpoint_required")) {
			console.log(
				"Instagram richiede un checkpoint. Verifica manualmente il tuo account.",
			);
		} else if (error.message.includes("login_required")) {
			console.log("Accesso fallito. Controlla username e password.");
		} else if (error.message.includes("rate limit")) {
			console.log(
				"Hai raggiunto il limite di richieste. Riprova tra qualche ora.",
			);
		}
	}
}

main().catch((error) => {
	console.error("Errore fatale:", error);
	process.exit(1);
});
