export const load = async ({ params, fetch }) => {
	const res = await fetch(`http://localhost:3000/people/${params.id}`);

	if (!res.ok) {
		throw new Error('Failed to load person');
	}

	const person = await res.json();

	return {
		person
	};
};
