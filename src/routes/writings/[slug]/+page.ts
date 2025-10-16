import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import info from '$lib/assets/pages_info.json';

export const load: PageLoad = ({ params }) => {
	const post = info.find((p) => p.slug === params.slug);
	if (post) {
		return {
			title: post.title,
            content: post.content,
		};
	}

	error(404, 'Not found');
};