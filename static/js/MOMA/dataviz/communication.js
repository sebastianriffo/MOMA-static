export function flaskCommunication(message){

	fetch(`${window.origin}/comm`, {
		method: "POST",
		credentials: "include",
		body: JSON.stringify(message),
		cache: "no-cache",
		headers: new Headers({"content-type": "application/json"})
	})
}