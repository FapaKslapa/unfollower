import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { type Feed, IgApiClient } from "instagram-private-api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getEnvCredentials() {
	try {
		const envPaths = [
			path.join(__dirname, ".env"),
			".env",
			path.join(__dirname, "..", ".env"),
			path.join(__dirname, "..", "..", "..", ".env"),
		];

		let envContent = "";

		for (const envPath of envPaths) {
			if (fs.existsSync(envPath)) {
				envContent = fs.readFileSync(envPath, "utf8");
				console.log(`File .env trovato in: ${envPath}`);
				break;
			}
		}

		if (!envContent) {
			throw new Error("File .env non trovato");
		}

		const credentials = {
			username: "",
			password: "",
		};

		const lines = envContent.split("\n");
		for (const line of lines) {
			if (line.startsWith("#") || !line.trim()) continue;

			const [key, value] = line.split("=");
			if (key && value) {
				const trimmedKey = key.trim();
				const trimmedValue = value.trim();

				if (trimmedKey === "IG_USERNAME") {
					credentials.username = trimmedValue;
				} else if (trimmedKey === "IG_PASSWORD") {
					credentials.password = trimmedValue;
				}
			}
		}

		return credentials;
	} catch (error) {
		console.error("Errore nella lettura del file .env:", error);
		return { username: "", password: "" };
	}
}

const credentials = getEnvCredentials();

console.log("Controllo delle credenziali:");
console.log(
	"IG_USERNAME:",
	credentials.username ? "IMPOSTATO" : "NON IMPOSTATO",
);
console.log(
	"IG_PASSWORD:",
	credentials.password ? "IMPOSTATO" : "NON IMPOSTATO",
);

interface InstagramUser {
	username: string;
	pk: string | number;
	full_name?: string;
	following?: boolean;
}

if (!credentials.username || !credentials.password) {
	console.error(
		"Errore: IG_USERNAME e IG_PASSWORD devono essere impostati nel file .env",
	);
	console.log("IG_USERNAME attuale:", credentials.username || "non definito");
	console.log(
		"IG_PASSWORD attuale:",
		credentials.password ? "IMPOSTATO" : "non definito",
	);
	process.exit(1);
}

const ig = new IgApiClient();
ig.state.generateDevice(credentials.username);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function unfollowUser(
	ig: IgApiClient,
	user: InstagramUser,
): Promise<boolean> {
	try {
		console.log(`\nRimozione in corso: ${user.username}...`);
		console.log(user);

		await sleep(3000 + Math.random() * 2000);

		try {
			const friendshipStatus = await ig.friendship.show(user.pk);
			console.log(`Stato amicizia:`, friendshipStatus);

			console.log(`Informazioni diagnostiche:`);
			console.log(`- User ID: ${user.pk}`);
			console.log(`- Username: ${user.username}`);
			console.log(`- Cookie User ID: ${ig.state.cookieUserId}`);

			if (friendshipStatus.following) {
				try {
					console.log(`Provo con il nuovo endpoint v1...`);
					const result = await ig.request.send({
						url: `api/v1/friendships/destroy/${user.pk}/`,
						method: "POST",
						form: {
							_csrftoken: ig.state.cookieCsrfToken,
							_uid: ig.state.cookieUserId,
							_uuid: ig.state.uuid,
							user_id: user.pk,
						},
						headers: {
							"User-Agent": ig.state.appUserAgent,
						},
					});
					console.log(`✓ Successo con endpoint v1:`, result.body);
					return true;
				} catch (err1) {
					console.log(
						`Errore con endpoint v1:`,
						err1 instanceof Error ? err1.message : err1,
					);
					await sleep(2000);
					try {
						console.log(`Provo con endpoint legacy...`);
						const result = await ig.request.send({
							url: `friendships/destroy/${user.pk}/`,
							method: "POST",
							form: {
								_csrftoken: ig.state.cookieCsrfToken,
								_uid: ig.state.cookieUserId,
								_uuid: ig.state.uuid,
								user_id: user.pk,
							},
						});
						console.log(`✓ Successo con endpoint legacy:`, result.body);
						return true;
					} catch (err2) {
						console.log(
							`Errore con endpoint legacy:`,
							err2 instanceof Error ? err2.message : err2,
						);
						await sleep(2000);

						try {
							console.log(`Provo con endpoint GraphQL...`);
							const userId =
								typeof user.pk === "string" ? user.pk : `${user.pk}`;

							const result = await ig.request.send({
								url: "graphql/mutation/",
								method: "POST",
								form: {
									_csrftoken: ig.state.cookieCsrfToken,
									_uid: ig.state.cookieUserId,
									_uuid: ig.state.uuid,
									id: userId,
									variables: JSON.stringify({
										id: userId,
										include_reel: true,
									}),
									doc_id: "3156817887699680", // ID della mutazione di unfollow
								},
							});
							console.log(`✓ Successo con GraphQL:`, result.body);
							return true;
						} catch (err3) {
							console.log(
								`Errore con GraphQL:`,
								err3 instanceof Error ? err3.message : err3,
							);

							try {
								console.log(`Riprovo con friendship.destroy originale...`);
								const userInfo = await ig.user.info(user.pk);
								console.log(
									`Informazioni utente recuperate:`,
									userInfo.pk,
									userInfo.username,
								);

								const result = await ig.friendship.destroy(userInfo.pk);
								console.log(
									`✓ Successo con friendship.destroy dopo verifica:`,
									result,
								);
								return true;
							} catch (err4) {
								console.log(
									`Tutti i tentativi falliti:`,
									err4 instanceof Error ? err4.message : err4,
								);
								throw new Error(
									`Tutti i metodi di unfollow falliti per ${user.username}`,
								);
							}
						}
					}
				}
			} else {
				console.log(
					`Secondo lo stato dell'amicizia, non stai seguendo ${user.username}`,
				);
				return false;
			}
		} catch (error) {
			console.error(
				`Errore durante il controllo dello stato dell'amicizia:`,
				error instanceof Error ? error.message : error,
			);
			throw error;
		}
	} catch (unfollowError: unknown) {
		const errorMessage =
			unfollowError instanceof Error
				? unfollowError.message
				: "Errore sconosciuto";
		const errorName =
			unfollowError instanceof Error ? unfollowError.name : "UnknownError";

		console.error(
			`✗ Impossibile smettere di seguire ${user.username}: ${errorMessage}`,
		);
		console.error(
			"Dettaglio errore:",
			JSON.stringify(
				{
					username: user.username,
					userId: user.pk,
					errorType: errorName,
					errorMessage: errorMessage,
				},
				null,
				2,
			),
		);
		return false;
	}
}
async function getAllItemsFromFeed<T>(feed: Feed<T>): Promise<InstagramUser[]> {
	const items: InstagramUser[] = [];
	do {
		const newItems = await feed.items();
		const validItems = newItems.filter(
			(item): item is InstagramUser =>
				typeof item === "object" &&
				item !== null &&
				"username" in item &&
				"pk" in item,
		);
		items.push(...validItems);
		await sleep(1000);
	} while (feed.isMoreAvailable());
	return items;
}

const MAX_USERS_TO_UNFOLLOW = 100;

(async () => {
	try {
		console.log("Tentativo di accesso con username:", credentials.username);
		await ig.account.login(credentials.username, credentials.password);
		console.log("Accesso riuscito!");

		console.log("Recupero delle liste di follower e following...");
		const followersFeed = ig.feed.accountFollowers(ig.state.cookieUserId);
		const followingFeed = ig.feed.accountFollowing(ig.state.cookieUserId);

		const followers = await getAllItemsFromFeed(followersFeed);
		const following = await getAllItemsFromFeed(followingFeed);

		console.log(
			`Hai ${followers.length} follower e stai seguendo ${following.length} utenti`,
		);

		const followersUsername = new Set(
			followers.map((user: InstagramUser) => user.username),
		);
		const notFollowingYou = following.filter(
			(user: InstagramUser) => !followersUsername.has(user.username),
		);

		console.log(`Trovati ${notFollowingYou.length} utenti che non ti seguono`);

		if (notFollowingYou.length === 0) {
			console.log("Nessun utente da smettere di seguire!");
			return;
		}

		const usersToProcess = notFollowingYou.slice(0, MAX_USERS_TO_UNFOLLOW);
		console.log(`Verranno rimossi ${usersToProcess.length} utenti`);

		let successCount = 0;
		for (const user of usersToProcess) {
			const success = await unfollowUser(ig, user);
			if (success) {
				successCount++;
			}
			await sleep(5000 + Math.random() * 5000);
		}

		console.log(
			`✅ Operazione completata. ${successCount} utenti rimossi con successo su ${usersToProcess.length} tentativi`,
		);
	} catch (error) {
		console.error("❌ Errore:", error);

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
			} else if (error.message.includes("ERR_INVALID_ARG_TYPE")) {
				console.log(
					"Errore di crittografia della password. Verifica che le credenziali siano caricate correttamente.",
				);
			} else if (error.message.includes("rate limit")) {
				console.log(
					"Hai raggiunto il limite di richieste. Riprova tra qualche ora.",
				);
			}
		}
	}
})();
