// src/routes/api/gatherings/[id]/songs/[songId]/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async (event) => {
	const churchId = event.locals.churchId;
    const supabase = event.locals.supabase;
	if (!churchId) throw error(400, 'Active church is required');

	const { songId } = event.params;
	const body = await event.request.json();

    const { data, error: updateError } = await supabase
        .from('service_instance_songs')
        .update({
            key: body.key,
            notes: body.notes,
            display_order: body.display_order,
            updated_at: new Date().toISOString()
        })
        .eq('id', songId)
        .eq('church_id', churchId)
        .select()
        .single();

	if (updateError) {
        console.error('PUT song failed', updateError);
		throw error(404, 'Song not found in gathering or update failed');
	}

	return json(data, { headers: { 'x-served-by': 'sveltekit' } });
};

export const DELETE: RequestHandler = async (event) => {
	const churchId = event.locals.churchId;
    const supabase = event.locals.supabase;
	if (!churchId) throw error(400, 'Active church is required');

	const { songId } = event.params;

    const { data, error: deleteError } = await supabase
        .from('service_instance_songs')
        .delete()
        .eq('id', songId)
        .eq('church_id', churchId)
        .select()
        .single();

	if (deleteError) {
        console.error('DELETE song failed', deleteError);
		throw error(404, 'Song not found in gathering');
	}

	return json(
		{ message: 'Song removed from gathering', song: data },
		{ headers: { 'x-served-by': 'sveltekit' } }
	);
};
