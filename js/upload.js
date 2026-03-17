const Upload = (() => {
    let selectedFiles = [];

    function init() {
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('file-input');
        const form = document.getElementById('upload-form');

        // Click to select
        dropzone.addEventListener('click', () => fileInput.click());

        // File input change
        fileInput.addEventListener('change', (e) => {
            addFiles(Array.from(e.target.files));
            fileInput.value = '';
        });

        // Drag & drop
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            addFiles(files);
        });

        // Submit
        form.addEventListener('submit', handleUpload);

        // Set default datetime
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('captured-at').value = now.toISOString().slice(0, 16);
    }

    function addFiles(files) {
        selectedFiles.push(...files);
        renderPreviews();
    }

    function removeFile(index) {
        selectedFiles.splice(index, 1);
        renderPreviews();
    }

    function renderPreviews() {
        const container = document.getElementById('file-preview');
        container.innerHTML = '';
        selectedFiles.forEach((file, i) => {
            const thumb = document.createElement('div');
            thumb.className = 'file-thumb';
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            const btn = document.createElement('button');
            btn.className = 'remove-file';
            btn.textContent = '✕';
            btn.onclick = (e) => { e.stopPropagation(); removeFile(i); };
            thumb.append(img, btn);
            container.appendChild(thumb);
        });
    }

    async function handleUpload(e) {
        e.preventDefault();
        const status = document.getElementById('upload-status');
        const progress = document.getElementById('upload-progress');
        const progressFill = progress.querySelector('.progress-fill');

        const cowId = document.getElementById('cow-id').value.trim();
        const behavior = document.getElementById('behavior').value;
        const barnArea = document.getElementById('barn-area').value.trim();
        const capturedAt = document.getElementById('captured-at').value;
        const notes = document.getElementById('notes').value.trim();

        // Validate
        if (!cowId) { showStatus(status, 'Vui lòng nhập mã con bò', 'error'); return; }
        if (!behavior) { showStatus(status, 'Vui lòng chọn hành vi', 'error'); return; }
        if (selectedFiles.length === 0) { showStatus(status, 'Vui lòng chọn ít nhất 1 ảnh', 'error'); return; }

        const uploadBtn = document.getElementById('upload-btn');
        uploadBtn.disabled = true;
        progress.hidden = false;
        showStatus(status, 'Đang tải lên...', 'info');

        let uploaded = 0;
        const total = selectedFiles.length;

        for (const file of selectedFiles) {
            try {
                const ext = file.name.split('.').pop() || 'jpg';
                const uniqueName = `${crypto.randomUUID()}.${ext}`;

                // Upload to storage
                const { error: storageError } = await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(uniqueName, file, { contentType: file.type });

                if (storageError) throw storageError;

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(uniqueName);

                // Insert record
                const { error: dbError } = await supabase
                    .from('cow_images')
                    .insert({
                        cow_id: cowId,
                        behavior: behavior,
                        barn_area: barnArea || null,
                        captured_at: capturedAt ? new Date(capturedAt).toISOString() : new Date().toISOString(),
                        notes: notes || null,
                        image_url: urlData.publicUrl,
                        file_name: uniqueName,
                        file_size: file.size,
                    });

                if (dbError) throw dbError;
                uploaded++;
            } catch (err) {
                console.error('Upload error:', err);
            }

            progressFill.style.width = `${(uploaded / total) * 100}%`;
        }

        uploadBtn.disabled = false;

        if (uploaded === total) {
            showStatus(status, `Đã tải lên thành công ${uploaded} ảnh!`, 'success');
            selectedFiles = [];
            document.getElementById('file-preview').innerHTML = '';
        } else {
            showStatus(status, `Tải lên ${uploaded}/${total} ảnh (một số bị lỗi)`, 'error');
        }

        setTimeout(() => {
            progress.hidden = true;
            progressFill.style.width = '0%';
        }, 2000);
    }

    function showStatus(el, msg, type) {
        el.textContent = msg;
        el.className = `status-msg ${type}`;
    }

    return { init };
})();
