# /scripts/insert_headers.py
import os
import re

# Configuration
extensions_map = {
    '.svelte': '<!-- {} -->',
    '.html': '<!-- {} -->',
    '.ts': '// {}',
    '.js': '// {}',
    '.css': '// {}',
    '.md': '// {}',
    '.jsonc': '// {}',
    '.sql': '-- {}',
    '.py': '# {}',
    '.sh': '# {}',
    '.yaml': '# {}',
    '.yml': '# {}'
}

ignore_dirs = {
    '.git', 'node_modules', '.svelte-kit', '.idea', '.vscode', 'coverage', 'dist', 'build', '.claude', '.gemini'
}

def get_comment_style(ext):
    return extensions_map.get(ext)

def is_license_content(text):
    text_lower = text.lower()
    return 'license' in text_lower or 'copyright' in text_lower

def get_insertion_index(lines, ext):
    """
    Determines where to insert the header.
    Returns index (0-based).
    """
    idx = 0
    if not lines:
        return 0

    # Check Shebang
    if lines[0].startswith('#!'):
        idx = 1

    # Check for License Block immediately following shebang (or at start)
    start_search = idx
    in_block_comment = False

    # Helper to check if line is a comment
    def is_comment(line):
        s = line.strip()
        if not s: return False, None # treat empty lines as non-comments for now?
        if ext in ['.ts', '.js', '.css', '.jsonc', '.md']:
            if s.startswith('//'): return True, 'line'
            if s.startswith('/*'): return True, 'block_start'
        elif ext in ['.svelte', '.html']:
            if s.startswith('<!--'): return True, 'block_start'
        elif ext == '.sql':
            if s.startswith('--'): return True, 'line'
        elif ext in ['.py', '.sh', '.yaml', '.yml']:
            if s.startswith('#'): return True, 'line'
        return False, None

    comment_lines = []
    end_of_block = idx

    i = idx
    while i < len(lines):
        line = lines[i]
        is_comm, c_type = is_comment(line)

        if not is_comm and not in_block_comment:
            if not line.strip():
                 # Empty line.
                 # If we are accumulating comments, usually a license block is contiguous.
                 if comment_lines:
                     break
                 else:
                     # Skip leading empty lines? No, insertion should be at top.
                     break
            else:
                break

        if c_type == 'block_start':
            in_block_comment = True

        if in_block_comment:
            comment_lines.append(line)
            if '*/' in line or '-->' in line:
                in_block_comment = False
                end_of_block = i + 1
        elif is_comm:
             comment_lines.append(line)
             end_of_block = i + 1

        i += 1

    # Check if the collected block looks like a license
    full_block = "".join(comment_lines)
    if is_license_content(full_block):
        return end_of_block

    return idx

def process_file(filepath, root_dir):
    rel_path = '/' + os.path.relpath(filepath, root_dir)
    _, ext = os.path.splitext(filepath)

    if ext not in extensions_map:
        return None

    comment_template = extensions_map[ext]
    expected_header_content = comment_template.format(rel_path)

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return None

    # Check first 10 lines for existing header
    found = False
    path_regex_str = re.escape(rel_path)

    for i in range(min(10, len(lines))):
        line = lines[i].strip()
        # Loose check: contains path and starts with comment char
        clean_line = line.replace(' ', '')
        clean_path = rel_path.replace(' ', '')
        if clean_path in clean_line:
             found = True
             break

    if found:
        return None # No change

    # Determine insertion point
    insert_idx = get_insertion_index(lines, ext)

    # Insert
    to_insert = expected_header_content + '\n'
    lines.insert(insert_idx, to_insert)

    # Write back
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        return rel_path
    except Exception as e:
        print(f"Error writing {filepath}: {e}")
        return None

def main():
    root_dir = os.getcwd()
    changed_files = []

    print(f"Scanning root: {root_dir}")

    for root, dirs, files in os.walk(root_dir):
        # Filter directories
        dirs[:] = [d for d in dirs if d not in ignore_dirs]

        for file in files:
            _, ext = os.path.splitext(file)
            if ext in extensions_map:
                filepath = os.path.join(root, file)
                # Skip self if matched by extension (py) and path
                # But we put header in self, so it should be skipped by 'found' check.

                res = process_file(filepath, root_dir)
                if res:
                    changed_files.append(res)
                    print(f"Updated: {res}")

    print(f"\nSummary: {len(changed_files)} files updated.")

if __name__ == '__main__':
    main()
