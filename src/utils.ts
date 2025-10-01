import type { Feed, IgApiClient } from "instagram-private-api";

export interface InstagramUser {
	username: string;
	pk: string | number;
	full_name?: string;
	following?: boolean;
}

export const sleep = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

export async function getAllItemsFromFeed<T>(
	feed: Feed<T>,
): Promise<InstagramUser[]> {
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

export async function unfollowUser(
	ig: IgApiClient,
	user: InstagramUser,
): Promise<boolean> {
	try {
		await sleep(1000 + Math.random() * 2000);

		const friendshipStatus = await ig.friendship.show(user.pk);

		if (friendshipStatus.following) {
			try {
				await ig.request.send({
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
				return true;
			} catch (_err1) {
				await sleep(1500);

				try {
					await ig.request.send({
						url: `friendships/destroy/${user.pk}/`,
						method: "POST",
						form: {
							_csrftoken: ig.state.cookieCsrfToken,
							_uid: ig.state.cookieUserId,
							_uuid: ig.state.uuid,
							user_id: user.pk,
						},
					});
					return true;
				} catch (_err2) {
					await sleep(1500);

					try {
						const userId = typeof user.pk === "string" ? user.pk : `${user.pk}`;
						await ig.request.send({
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
								doc_id: "3156817887699680",
							},
						});
						return true;
					} catch (_err3) {
						try {
							const userInfo = await ig.user.info(user.pk);
							await ig.friendship.destroy(userInfo.pk);
							return true;
						} catch (_err4) {
							console.error(
								`Tutti i metodi di unfollow falliti per ${user.username}`,
							);
							return false;
						}
					}
				}
			}
		} else {
			return false;
		}
	} catch (unfollowError: unknown) {
		console.error(
			`Errore durante l'unfollow di ${user.username}:`,
			unfollowError,
		);
		return false;
	}
}
