<!-- src/routes/songs/new/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthorInput from '$lib/components/AuthorInput.svelte';
	import { ArrowLeft, Save, Wand2 } from '@lucide/svelte';

	let loading = $state(false);
	let localAuthors = $state<{ id?: string; name: string }[]>([]);

	// Form Bindings
	let title = $state('');
	let artist = $state('');
	let key = $state('C');
	let tempo = $state('');
	let timeSignature = $state('4/4');
	let ccli = $state('');
	let copyright = $state('');
	let youtubeUrl = $state('');
	let spotifyUrl = $state('');
	let notes = $state('');
	let content = $state('');

	const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

	// --- THE SMART PARSER ---
	let pasteAreaOpen = $state(true); // Open by default for quick access
	let pasteContent = $state('');

	const CHORD_TOKEN = /^[A-G][#b]?[a-zA-Z0-9/()]*$/;

	function isChordLine(line: string) {
		const tokens = line.trim().split(/\s+/);
		return tokens.length > 0 && tokens.every((t) => CHORD_TOKEN.test(t));
	}

	function mergeChordLineIntoLyric(chordLine: string, lyricLine: string) {
		const tokens: { chord: string; col: number }[] = [];
		const regex = /\S+/g;
		let m: RegExpExecArray | null;
		while ((m = regex.exec(chordLine)) !== null) {
			tokens.push({ chord: m[0], col: m.index });
		}

		// Insert chords at their character positions in the lyric line
		let result = '';
		let lastIdx = 0;
		for (const { chord, col } of tokens) {
			const insertAt = Math.min(col, lyricLine.length);
			result += lyricLine.slice(lastIdx, insertAt) + '[' + chord + ']';
			lastIdx = insertAt;
		}
		result += lyricLine.slice(lastIdx);
		return result;
	}

	function preProcessChordLines(lines: string[]) {
		const result: string[] = [];
		let i = 0;
		while (i < lines.length) {
			const line = lines[i];
			if (isChordLine(line) && line.trim().length > 0) {
				const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
				if (nextLine.trim() && !isChordLine(nextLine)) {
					// Chord line followed by lyric line — merge
					result.push(mergeChordLineIntoLyric(line, nextLine));
					i += 2;
				} else {
					// Chord-only line (intro, interlude) — wrap each token
					result.push(line.replace(/\S+/g, (token) => '[' + token + ']'));
					i += 1;
				}
			} else {
				result.push(line);
				i += 1;
			}
		}
		return result;
	}

	function normalizeCopyright(raw: string) {
		let val = raw.trim();
		// Convert (c) → ©
		val = val.replace(/\(c\)/gi, '©');
		// Prepend © if missing
		if (!val.startsWith('©')) val = '© ' + val;
		return val;
	}

	function magicParse() {
		if (!pasteContent.trim()) return;

		// Pre-process: detect chord-above-lyric format and merge
		const rawLines = pasteContent.split('\n');
		const lines = preProcessChordLines(rawLines);
		const remainingLines: string[] = [];

		lines.forEach((line) => {
			const trim = line.trim();
			let handled = false;

			// 1. Title detection
			const titleMatch =
				trim.match(/^\{(?:t|title):\s*(.*?)\}$/i) || trim.match(/^Title:\s*(.*)$/i);
			if (titleMatch) {
				title = titleMatch[1];
				handled = true;
			}

			// 2. Author detection (songwriters/copyright)
			const authorMatch =
				trim.match(/^\{(?:a|author|st|subtitle):\s*(.*?)\}$/i) || trim.match(/^Author:\s*(.*)$/i);
			if (authorMatch) {
				// Split by common delimiters to find multiple authors
				const rawAuthors = authorMatch[1].split(/,| and |&/);
				rawAuthors.forEach((a) => {
					const name = a.trim();
					// Avoid duplicates
					if (name && !localAuthors.find((la) => la.name === name)) {
						localAuthors.push({ name });
					}
				});
				handled = true;
			}

			// 2b. Artist detection (recording artist reference)
			const artistMatch =
				trim.match(/^\{(?:ar|artist):\s*(.*?)\}$/i) ||
				trim.match(/^(?:Artist|Recording Artist):\s*(.*)$/i);
			if (artistMatch) {
				artist = artistMatch[1].trim();
				handled = true;
			}

			// 3. Key detection
			const keyMatch = trim.match(/^\{(?:k|key):\s*(.*?)\}$/i) || trim.match(/^Key:\s*(.*)$/i);
			if (keyMatch) {
				// Clean up "G Major" -> "G"
				const k = keyMatch[1].split(' ')[0];
				if (KEYS.includes(k)) key = k;
				handled = true;
			}

			// 4. Tempo/BPM detection
			const bpmMatch =
				trim.match(/^\{(?:tempo|bpm):\s*(.*?)\}$/i) || trim.match(/^(?:BPM|Tempo):\s*(.*)$/i);
			if (bpmMatch) {
				tempo = bpmMatch[1];
				handled = true;
			}

			// 5. CCLI detection
			const ccliMatch =
				trim.match(/^\{(?:ccli):\s*(.*?)\}$/i) || trim.match(/^CCLI:?\s*#?\s*(\d+)/i);
			if (ccliMatch) {
				ccli = ccliMatch[1];
				handled = true;
			}

			// 6. Time signature detection
			const timeMatch =
				trim.match(/^\{(?:time|time_signature):\s*(.*?)\}$/i) ||
				trim.match(/^(?:Time|Time Signature):\s*(.*)$/i);
			if (timeMatch) {
				timeSignature = timeMatch[1].trim();
				handled = true;
			}

			// 7. Copyright detection
			const copyrightMatch =
				trim.match(/^\{(?:copyright|c):\s*(.*?)\}$/i) || trim.match(/^Copyright:\s*(.*)$/i);
			if (copyrightMatch) {
				copyright = normalizeCopyright(copyrightMatch[1]);
				handled = true;
			}

			// 8. YouTube detection
			const youtubeMatch =
				trim.match(/^\{(?:youtube|yt):\s*(.*?)\}$/i) || trim.match(/^YouTube:\s*(.*)$/i);
			if (youtubeMatch) {
				youtubeUrl = youtubeMatch[1].trim();
				handled = true;
			}

			// 9. Spotify detection
			const spotifyMatch =
				trim.match(/^\{(?:spotify|sp):\s*(.*?)\}$/i) || trim.match(/^Spotify:\s*(.*)$/i);
			if (spotifyMatch) {
				spotifyUrl = spotifyMatch[1].trim();
				handled = true;
			}

			// If it wasn't metadata, it's chart content
			if (!handled) remainingLines.push(line);
		});

		// Join remaining lines and trim empty start/end
		content = remainingLines.join('\n').trim();

		// Close the box so they can see the result
		pasteAreaOpen = false;
	}
</script>

<div class="min-h-screen bg-stone-50 pb-20">
	<div class="sticky top-0 z-10 border-b border-stone-200 bg-white shadow-sm">
		<div class="mx-auto max-w-3xl px-4 py-4 sm:px-6 lg:px-8">
			<div class="flex items-center gap-4">
				<a href="/songs" class="text-stone-400 transition-colors hover:text-slate-900">
					<ArrowLeft size={20} />
				</a>
				<h1 class="text-xl font-bold text-slate-900">Add New Song</h1>
			</div>
		</div>
	</div>

	<div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
		<div class="mb-8 rounded-xl border border-blue-100 bg-blue-50/50 p-6">
			<button
				onclick={() => (pasteAreaOpen = !pasteAreaOpen)}
				class="mb-2 flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800"
			>
				<Wand2 size={16} />
				{pasteAreaOpen ? 'Hide Smart Import' : 'Open Smart Import'}
			</button>

			{#if pasteAreaOpen}
				<p class="mb-3 text-xs text-blue-600">
					Paste text from SongSelect, ChordPro, or a PDF. We'll try to extract the details.
				</p>
				<textarea
					bind:value={pasteContent}
					class="mb-3 h-32 w-full rounded-md border-blue-200 font-mono text-xs focus:border-blue-500 focus:ring-blue-500"
					placeholder={`{title: Amazing Grace}\n{author: John Newton}\n[G]Amazing [C]Grace...`}
				></textarea>
				<button
					onclick={magicParse}
					class="rounded-md bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
				>
					Auto-Fill Form
				</button>
			{/if}
		</div>

		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					await update();
					loading = false;
				};
			}}
			class="space-y-6"
		>
			<div class="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
				<div class="space-y-6">
					<div>
						<label for="title" class="block text-xs font-medium text-slate-700">Song Title</label>
						<input
							type="text"
							id="title"
							name="title"
							bind:value={title}
							required
							class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
						/>
					</div>

					<div>
						<span class="mb-1 block text-xs font-medium text-slate-700">Author(s)</span>
						<AuthorInput bind:selectedAuthors={localAuthors} />
						<input type="hidden" name="authors_json" value={JSON.stringify(localAuthors)} />
						<p class="mt-1 text-[10px] text-stone-400">Songwriters for copyright attribution.</p>
					</div>

					<div>
						<label for="artist" class="block text-xs font-medium text-slate-700">Recording Artist</label>
						<input
							type="text"
							id="artist"
							name="artist"
							bind:value={artist}
							placeholder="e.g. Hillsong Worship"
							class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
						/>
						<p class="mt-1 text-[10px] text-stone-400">Reference recording (optional).</p>
					</div>

					<div class="grid grid-cols-3 gap-4">
						<div>
							<label for="key" class="block text-xs font-medium text-slate-700">Original Key</label>
							<select
								id="key"
								name="key"
								bind:value={key}
								class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
							>
								{#each KEYS as k}
									<option value={k}>{k}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="tempo" class="block text-xs font-medium text-slate-700">Tempo (BPM)</label
							>
							<input
								type="text"
								id="tempo"
								name="tempo"
								bind:value={tempo}
								class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
							/>
						</div>
						<div>
							<label for="time_signature" class="block text-xs font-medium text-slate-700">Time Sig.</label>
							<select
								id="time_signature"
								name="time_signature"
								bind:value={timeSignature}
								class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
							>
								<option value="4/4">4/4</option>
								<option value="3/4">3/4</option>
								<option value="6/8">6/8</option>
								<option value="2/4">2/4</option>
								<option value="9/8">9/8</option>
								<option value="12/8">12/8</option>
							</select>
						</div>
					</div>

					<div>
						<label for="notes" class="block text-xs font-medium text-slate-700"
							>Performance Notes</label
						>
						<input
							type="text"
							id="notes"
							name="performance_notes"
							bind:value={notes}
							placeholder="e.g. Light swing, building..."
							class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
						/>
					</div>

					<div>
						<label for="ccli" class="block text-xs font-medium text-slate-700">CCLI #</label>
						<input
							type="text"
							id="ccli"
							name="ccli"
							bind:value={ccli}
							class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
						/>
					</div>

					<div>
						<label for="copyright" class="block text-xs font-medium text-slate-700">Copyright</label>
						<input
							type="text"
							id="copyright"
							name="copyright"
							bind:value={copyright}
							placeholder="e.g. © 1998 Vineyard Songs"
							class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
						/>
					</div>

					<div>
						<label for="youtube_url" class="block text-xs font-medium text-slate-700">YouTube URL</label>
						<input
							type="url"
							id="youtube_url"
							name="youtube_url"
							bind:value={youtubeUrl}
							placeholder="https://youtube.com/watch?v=..."
							class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
						/>
					</div>

					<div>
						<label for="spotify_url" class="block text-xs font-medium text-slate-700">Spotify URL</label>
						<input
							type="url"
							id="spotify_url"
							name="spotify_url"
							bind:value={spotifyUrl}
							placeholder="https://open.spotify.com/track/..."
							class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
						/>
					</div>
				</div>
			</div>

			<div class="flex h-[500px] flex-col rounded-xl border border-stone-200 bg-white shadow-sm">
				<div class="border-b border-stone-100 bg-stone-50 px-4 py-2">
					<span class="text-xs font-bold text-stone-500 uppercase">Master Chart (ChordPro)</span>
				</div>
				<textarea
					name="content"
					bind:value={content}
					class="w-full flex-1 resize-none border-0 p-6 font-mono text-sm leading-loose focus:ring-0"
					placeholder="[V1]&#10;[G]Amazing [C]Grace..."
				></textarea>
			</div>

			<div class="flex justify-end pt-4">
				<button
					type="submit"
					disabled={loading}
					class="flex items-center gap-2 rounded-md bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
				>
					<Save size={16} />
					{loading ? 'Creating...' : 'Create Song'}
				</button>
			</div>
		</form>
	</div>
</div>
