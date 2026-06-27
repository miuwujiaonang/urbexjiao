// ========== 主应用模块 ==========

const App = {
    uploadedImagePaths: [],  // 上传废墟时已上传的图片路径
    selectedDifficulty: 1,
    csvImportItems: [],      // CSV 批量导入数据列表

    // 初始化
    async init() {
        // 初始化地图
        MapModule.init();

        // 更新认证UI
        Auth.updateUI();

        // 加载废墟数据
        await this.loadRuins();

        // 绑定事件
        this.bindEvents();

        // 移动端默认收起侧边栏
        if (window.innerWidth <= 480) {
            document.getElementById('sidebar').classList.add('collapsed');
            document.getElementById('expandSidebar').style.display = 'block';
        }

        // 监听窗口尺寸变化
        window.addEventListener('resize', () => MapModule.map.invalidateSize());
    },

    // 加载废墟
    async loadRuins(filters = {}) {
        try {
            await Ruins.fetch(filters);
            Ruins.displayOnMap();
            Ruins.updateStats();
            Ruins.updateRegionFilters();
        } catch (e) {
            // 加载失败时不清除现有标记, 避免点位"消失"
            console.error('加载废墟失败:', e);
            this.toast('加载废墟数据失败，已保留现有标记', 'error');
        }
    },

    // 绑定所有事件
    bindEvents() {
        // 搜索模式切换
        document.querySelectorAll('.search-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const mode = tab.dataset.mode;
                const input = document.getElementById('searchInput');
                if (mode === 'ruins') {
                    input.placeholder = '搜索废墟名称或描述...';
                    document.getElementById('placeSuggestions').style.display = 'none';
                } else {
                    input.placeholder = '搜索任意地点(如: 北京 故宫)...';
                }
                input.value = '';
            });
        });

        // 搜索按钮
        document.getElementById('searchBtn').addEventListener('click', () => {
            const mode = document.querySelector('.search-tab.active').dataset.mode;
            if (mode === 'place') {
                this.searchPlace();
            } else {
                this.applyFilters();
            }
        });
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key !== 'Enter') return;
            const mode = document.querySelector('.search-tab.active').dataset.mode;
            if (mode === 'place') {
                this.searchPlace();
            } else {
                this.applyFilters();
            }
        });

        // 地点搜索实时建议
        let placeTimer = null;
        document.getElementById('searchInput').addEventListener('input', (e) => {
            const mode = document.querySelector('.search-tab.active').dataset.mode;
            if (mode !== 'place') return;
            clearTimeout(placeTimer);
            const val = e.target.value.trim();
            if (val.length < 2) {
                document.getElementById('placeSuggestions').style.display = 'none';
                return;
            }
            placeTimer = setTimeout(() => this.searchPlaceSuggestions(val), 400);
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.topbar-center')) {
                document.getElementById('placeSuggestions').style.display = 'none';
            }
        });

        // 筛选
        document.getElementById('applyFilter').addEventListener('click', () => this.applyFilters());
        document.getElementById('resetFilter').addEventListener('click', () => this.resetFilters());

        // 省份联动: 选定省份后刷新城市选项
        document.getElementById('filterProvince').addEventListener('change', () => {
            Ruins.updateRegionFilters();
        });

        // 工具按钮(侧边栏)
        document.getElementById('btnAddRuin').addEventListener('click', () => this.openRuinModal());
        document.getElementById('btnMeasure').addEventListener('click', () => this.toggleTool('measure'));
        document.getElementById('btnRoute').addEventListener('click', () => this.toggleTool('route'));
        document.getElementById('btnMarkPoint').addEventListener('click', () => this.toggleTool('mark'));
        document.getElementById('btnClearMarks').addEventListener('click', () => MapModule.clearClickMarkers());

        // CSV 批量导入
        document.getElementById('btnCsvImport').addEventListener('click', () => this.openCsvImport());
        document.getElementById('csvParseBtn').addEventListener('click', () => this.handleCsvParse());
        document.getElementById('csvDownloadTemplate').addEventListener('click', () => this.downloadCsvTemplate());
        document.getElementById('csvUploadAll').addEventListener('click', () => this.uploadAllCsv());
        document.getElementById('csvClearAll').addEventListener('click', () => {
            this.csvImportItems = [];
            this.renderCsvList();
            document.getElementById('csvListSection').style.display = 'none';
        });

        // 浮动按钮(地图上)
        document.getElementById('fabAddRuin').addEventListener('click', () => this.openRuinModal());
        document.getElementById('fabMarkPoint').addEventListener('click', () => this.toggleTool('mark'));
        document.getElementById('fabMeasure').addEventListener('click', () => this.toggleTool('measure'));
        document.getElementById('fabRoute').addEventListener('click', () => this.toggleTool('route'));

        // 路线规划
        document.getElementById('calcRoute').addEventListener('click', () => MapModule.calculateRoute());
        document.getElementById('clearRoute').addEventListener('click', () => MapModule.clearRoute());

        // 侧边栏收起/展开
        document.getElementById('toggleSidebar').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('expandSidebar').addEventListener('click', () => this.toggleSidebar());

        // 弹窗关闭
        document.querySelectorAll('.modal-close').forEach(el => {
            el.addEventListener('click', () => {
                document.getElementById(el.dataset.modal).style.display = 'none';
            });
        });

        // 认证表单切换
        document.getElementById('switchToRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.openAuthModal('register');
        });

        // 认证表单提交
        document.getElementById('authForm').addEventListener('submit', (e) => this.handleAuthSubmit(e));

        // 管理员登录按钮
        document.getElementById('adminLoginBtn').addEventListener('click', () => this.handleAdminLogin());

        // 废墟表单提交
        document.getElementById('ruinForm').addEventListener('submit', (e) => this.handleRuinSubmit(e));

        // GPS定位
        document.getElementById('useGPS').addEventListener('click', () => this.useGPSLocation());

        // 地图点击选择位置
        document.getElementById('useMapClick').addEventListener('click', () => this.enableMapClickForRuin());

        // 图片上传预览
        document.getElementById('ruinImages').addEventListener('change', (e) => this.handleImageUpload(e));

        // 星级评分
        document.querySelectorAll('#ruinDifficulty .star').forEach(star => {
            star.addEventListener('click', () => this.setDifficulty(parseInt(star.dataset.value)));
            star.addEventListener('mouseenter', () => this.previewDifficulty(parseInt(star.dataset.value)));
        });
        document.getElementById('ruinDifficulty').addEventListener('mouseleave', () => this.setDifficulty(this.selectedDifficulty));
    },

    // === 认证 ===
    openAuthModal(mode) {
        const modal = document.getElementById('authModal');
        const title = document.getElementById('authModalTitle');
        const submit = document.getElementById('authSubmit');
        const emailGroup = document.getElementById('emailGroup');
        const switchText = document.getElementById('authSwitch');

        // 重置管理员模式标记
        this.isAdminLoginMode = false;

        if (mode === 'register') {
            title.textContent = '注册';
            submit.textContent = '注册';
            emailGroup.style.display = 'block';
            switchText.style.display = 'block';
            switchText.innerHTML = '已有账号？<a href="#" id="switchToLogin">登录</a>';
            document.getElementById('switchToLogin').addEventListener('click', (e) => {
                e.preventDefault();
                this.openAuthModal('login');
            });
        } else {
            title.textContent = '登录';
            submit.textContent = '登录';
            emailGroup.style.display = 'none';
            switchText.style.display = 'block';
            switchText.innerHTML = '没有账号？<a href="#" id="switchToRegister">注册</a>';
            document.getElementById('switchToRegister').addEventListener('click', (e) => {
                e.preventDefault();
                this.openAuthModal('register');
            });
        }

        modal.style.display = 'flex';
    },

    async handleAuthSubmit(e) {
        e.preventDefault();
        const username = document.getElementById('authUsername').value.trim();
        const password = document.getElementById('authPassword').value;
        const email = document.getElementById('authEmail').value.trim();
        const submitBtn = document.getElementById('authSubmit');
        const isRegister = submitBtn.textContent === '注册';
        const isAdminMode = this.isAdminLoginMode === true;

        // 前端邮箱格式验证(注册时)
        if (isRegister && email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                this.toast('邮箱格式不正确', 'error');
                return;
            }
        }

        // 管理员模式: 前端先校验账号密码, 必须是预设的管理员账号
        if (isAdminMode) {
            if (username !== 'adurbex0626' || password !== '06261228') {
                this.toast('管理员账号或密码不正确', 'error');
                return;
            }
        }

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = '处理中...';
            if (isRegister) {
                await Auth.register(username, password, email);
            } else {
                await Auth.login(username, password);
            }
            // 管理员模式下, 二次校验返回的用户确实是管理员
            if (isAdminMode && !Auth.isAdmin()) {
                Auth.logout();
                this.toast('管理员账号或密码不正确', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = '管理员登录';
                return;
            }
            Auth.updateUI();
            document.getElementById('authModal').style.display = 'none';
            document.getElementById('authForm').reset();
            // 重置管理员模式标记
            this.isAdminLoginMode = false;
            const successMsg = isAdminMode ? '管理员登录成功！' : (isRegister ? '注册成功！' : '登录成功！');
            this.toast(successMsg, 'success');
        } catch (err) {
            this.toast(err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            if (isAdminMode) {
                submitBtn.textContent = '管理员登录';
            } else {
                submitBtn.textContent = isRegister ? '注册' : '登录';
            }
        }
    },

    // 管理员登录: 切换到管理员登录界面, 让用户输入账号密码
    handleAdminLogin() {
        // 打开登录弹窗
        this.openAuthModal('login');
        // 修改标题和按钮文字提示管理员模式
        document.getElementById('authModalTitle').textContent = '管理员登录';
        const submitBtn = document.getElementById('authSubmit');
        submitBtn.textContent = '管理员登录';
        // 标记为管理员登录模式
        this.isAdminLoginMode = true;
        // 隐藏切换注册链接和邮箱字段
        document.getElementById('authSwitch').style.display = 'none';
        document.getElementById('emailGroup').style.display = 'none';
        // 聚焦用户名输入框
        document.getElementById('authUsername').focus();
        this.toast('请输入管理员账号和密码', 'success');
    },

    // === 地点搜索(Nominatim) ===
    async searchPlace() {
        const input = document.getElementById('searchInput');
        const val = input.value.trim();
        if (val.length < 2) {
            this.toast('请输入至少2个字符', 'error');
            return;
        }
        const suggest = document.getElementById('placeSuggestions');
        suggest.innerHTML = '<div style="padding:8px;color:#999;">搜索中...</div>';
        suggest.style.display = 'block';
        try {
            const places = await MapModule.searchPlaces(val);
            if (places.length === 0) {
                suggest.innerHTML = '<div style="padding:8px;color:#999;">未找到地点</div>';
                return;
            }
            this.renderPlaceSuggestions(places);
        } catch (e) {
            suggest.innerHTML = '<div style="padding:8px;color:#e74c3c;">搜索失败</div>';
        }
    },

    async searchPlaceSuggestions(val) {
        const suggest = document.getElementById('placeSuggestions');
        try {
            const places = await MapModule.searchPlaces(val);
            if (places.length === 0) {
                suggest.innerHTML = '';
                suggest.style.display = 'none';
                return;
            }
            this.renderPlaceSuggestions(places);
        } catch (e) {
            console.error('地点建议失败:', e);
        }
    },

    // 渲染地点建议列表
    renderPlaceSuggestions(places) {
        const suggest = document.getElementById('placeSuggestions');
        suggest.innerHTML = places.map((p, i) => `
            <div class="place-suggestion-item" data-idx="${i}">
                <div class="place-name">${p.shortName}</div>
                <div class="place-addr">${p.name}</div>
            </div>
        `).join('');
        suggest.style.display = 'block';
        suggest.querySelectorAll('.place-suggestion-item').forEach((item, i) => {
            item.addEventListener('click', () => {
                const place = places[i];
                MapModule.flyTo(place.lat, place.lng, 14);
                MapModule.addPlaceMarker(place.lat, place.lng, place.shortName);
                suggest.style.display = 'none';
                document.getElementById('searchInput').value = place.shortName;
                this.toast(`已定位到: ${place.shortName}`, 'success');
            });
        });
    },

    // === 筛选 ===
    applyFilters() {
        const filters = {
            search: document.getElementById('searchInput').value.trim(),
            category: document.getElementById('filterCategory').value,
            country: document.getElementById('filterCountry').value,
            province: document.getElementById('filterProvince').value,
            city: document.getElementById('filterCity').value,
            difficulty: document.getElementById('filterDifficulty').value,
        };
        const securityRadio = document.querySelector('input[name="security"]:checked');
        const dogsRadio = document.querySelector('input[name="dogs"]:checked');
        if (securityRadio && securityRadio.value) filters.has_security = securityRadio.value;
        if (dogsRadio && dogsRadio.value) filters.has_dogs = dogsRadio.value;

        this.loadRuins(filters);
        this.toast('筛选已应用', 'success');
    },

    resetFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('filterCategory').value = '';
        document.getElementById('filterCountry').value = '';
        document.getElementById('filterProvince').value = '';
        document.getElementById('filterCity').value = '';
        document.getElementById('filterDifficulty').value = '';
        document.querySelector('input[name="security"][value=""]').checked = true;
        document.querySelector('input[name="dogs"][value=""]').checked = true;
        this.loadRuins();
        this.toast('筛选已重置', 'success');
    },

    // === 工具切换(浮动按钮高亮) ===
    toggleTool(tool) {
        // 清除所有按钮的 active 状态
        document.querySelectorAll('.fab-tool').forEach(b => b.classList.remove('active'));
        const map = { mark: 'fabMarkPoint', measure: 'fabMeasure', route: 'fabRoute' };
        const btnId = map[tool];
        if (btnId) {
            const btn = document.getElementById(btnId);
            // 如果当前已经激活则关闭，否则激活
            const isActive = btn.classList.contains('active');
            if (isActive) {
                btn.classList.remove('active');
                MapModule.measureMode = false;
                MapModule.clickMarkMode = false;
                MapModule.routeMode = false;
                MapModule.clearMeasure();
                return;
            }
            btn.classList.add('active');
        }
        if (tool === 'mark') MapModule.enableClickMark();
        else if (tool === 'measure') MapModule.enableMeasure();
        else if (tool === 'route') MapModule.enableRoute();
    },

    // === 上传废墟 ===
    openRuinModal() {
        if (!Auth.isLoggedIn()) {
            this.toast('请先登录', 'error');
            this.openAuthModal('login');
            return;
        }
        this.uploadedImagePaths = [];
        this.selectedDifficulty = 1;
        this.editingRuinId = null;  // 重置编辑模式
        this.setDifficulty(1);
        document.getElementById('ruinForm').reset();
        document.getElementById('imagePreview').innerHTML = '';
        document.querySelector('#ruinModal h2').textContent = '上传废墟';
        document.querySelector('#ruinForm button[type="submit"]').textContent = '提交废墟';
        document.getElementById('ruinModal').style.display = 'flex';
    },

    async handleRuinSubmit(e) {
        e.preventDefault();
        if (!Auth.isLoggedIn()) {
            this.toast('请先登录', 'error');
            return;
        }

        const data = {
            name: document.getElementById('ruinName').value.trim(),
            category: document.getElementById('ruinCategory').value,
            latitude: parseFloat(document.getElementById('ruinLat').value),
            longitude: parseFloat(document.getElementById('ruinLng').value),
            description: document.getElementById('ruinDescription').value.trim(),
            has_security: parseInt(document.getElementById('ruinSecurity').value),
            has_dogs: parseInt(document.getElementById('ruinDogs').value),
            difficulty: this.selectedDifficulty,
            route: document.getElementById('ruinRoute').value.trim(),
            is_sensitive: parseInt(document.getElementById('ruinSensitive').value),
            is_public: document.getElementById('ruinPublic').value === '1',
            country: document.getElementById('ruinCountry').value.trim(),
            province: document.getElementById('ruinProvince').value.trim(),
            city: document.getElementById('ruinCity').value.trim(),
            district: document.getElementById('ruinDistrict').value.trim(),
            external_link: document.getElementById('ruinExternalLink').value.trim(),
        };

        try {
            if (this.editingRuinId) {
                // 编辑模式: PUT 请求
                const res = await fetch(`${API_BASE}/api/ruins/` + this.editingRuinId, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...Auth.getAuthHeader()
                    },
                    body: JSON.stringify(data)
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || '更新失败');

                // 上传新图片(若有)
                if (this.uploadedImagePaths.length > 0) {
                    for (const path of this.uploadedImagePaths) {
                        await Ruins.addImage(this.editingRuinId, path.path, path.description || '');
                    }
                }

                this.toast('废墟更新成功！', 'success');
            } else {
                // 新建模式: POST 请求
                const result = await Ruins.create(data);

                // 上传图片
                if (this.uploadedImagePaths.length > 0) {
                    for (const path of this.uploadedImagePaths) {
                        await Ruins.addImage(result.id, path.path, path.description || '');
                    }
                }

                this.toast('废墟上传成功！', 'success');
            }

            document.getElementById('ruinModal').style.display = 'none';
            this.editingRuinId = null;
            await this.loadRuins();
        } catch (err) {
            this.toast(err.message, 'error');
        }
    },

    // GPS定位(支持权限检测和重试引导)
    async useGPSLocation() {
        // 先用 Permissions API 检查权限状态
        if (navigator.permissions && navigator.permissions.query) {
            try {
                const result = await navigator.permissions.query({ name: 'geolocation' });
                if (result.state === 'denied') {
                    this.toast('定位权限已被拒绝。请点击浏览器地址栏左侧的锁/信息图标，将"位置"权限改为"允许"后重试', 'error');
                    return;
                }
            } catch (e) { /* 部分浏览器不支持，忽略 */ }
        }

        try {
            this.toast('正在获取定位，若浏览器弹窗请选择"允许"...', 'success');
            const [lat, lng] = await MapModule.GPS();
            document.getElementById('ruinLat').value = lat.toFixed(6);
            document.getElementById('ruinLng').value = lng.toFixed(6);
            MapModule.flyTo(lat, lng, 16);
            this.toast('定位成功', 'success');
        } catch (err) {
            // err.code: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
            if (err.code === 1) {
                this.toast('您拒绝了定位权限。请点击浏览器地址栏左侧图标，将位置权限改为"允许"后再次点击按钮重试', 'error');
            } else if (err.code === 3) {
                this.toast('定位超时，请重试', 'error');
            } else {
                this.toast('定位失败: ' + (err.message || '未知错误'), 'error');
            }
        }
    },

    // 地图点击选择位置
    enableMapClickForRuin() {
        this.toast('请在地图上点击选择废墟位置', 'success');
        document.getElementById('ruinModal').style.display = 'none';
        const handler = (e) => {
            document.getElementById('ruinLat').value = e.latlng.lat.toFixed(6);
            document.getElementById('ruinLng').value = e.latlng.lng.toFixed(6);
            MapModule.map.off('click', handler);
            document.getElementById('ruinModal').style.display = 'flex';
            this.toast('位置已选择', 'success');
        };
        MapModule.map.on('click', handler);
    },

    // 图片上传
    async handleImageUpload(e) {
        const files = e.target.files;
        const preview = document.getElementById('imagePreview');
        for (const file of files) {
            try {
                // 上传
                const path = await Ruins.uploadImage(file);
                const idx = this.uploadedImagePaths.length;
                this.uploadedImagePaths.push({ path, description: '' });

                // 预览 + 删除按钮
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'image-preview-item';
                    wrapper.dataset.idx = idx;
                    wrapper.innerHTML = `
                        <img src="${ev.target.result}" />
                        <button type="button" class="image-preview-remove" title="删除">&times;</button>
                    `;
                    wrapper.querySelector('.image-preview-remove').addEventListener('click', () => {
                        // 从已上传列表移除(用 path 匹配, 避免索引错乱)
                        const removePath = wrapper.dataset.path;
                        this.uploadedImagePaths = this.uploadedImagePaths.filter(p => p.path !== removePath);
                        wrapper.remove();
                    });
                    // 上传成功后把 path 存到 wrapper 上, 方便后续删除
                    wrapper.dataset.path = path;
                    preview.appendChild(wrapper);
                };
                reader.readAsDataURL(file);
            } catch (err) {
                this.toast('图片上传失败: ' + err.message, 'error');
            }
        }
        // 清空 input, 允许再次选择同一文件
        e.target.value = '';
    },

    // 星级评分
    setDifficulty(value) {
        this.selectedDifficulty = value;
        document.getElementById('ruinDifficultyValue').value = value;
        document.querySelectorAll('#ruinDifficulty .star').forEach(star => {
            star.classList.toggle('active', parseInt(star.dataset.value) <= value);
        });
    },

    previewDifficulty(value) {
        document.querySelectorAll('#ruinDifficulty .star').forEach(star => {
            star.classList.toggle('active', parseInt(star.dataset.value) <= value);
        });
    },

    // === 废墟详情 ===
    async showDetail(id) {
        try {
            const ruin = await Ruins.fetchById(id);
            // 评价加载失败时不影响详情显示
            let reviews = [];
            try {
                reviews = await Ruins.fetchReviews(id);
            } catch (reviewErr) {
                console.error('加载评价失败:', reviewErr);
            }
            this.renderDetail(ruin, reviews);
        } catch (err) {
            this.toast(err.message, 'error');
        }
    },

    renderDetail(ruin, reviews) {
        const modal = document.getElementById('detailModal');
        const content = document.getElementById('detailContent');
        const diff = parseInt(ruin.difficulty) || 1;
        const stars = '★'.repeat(diff) + '☆'.repeat(5 - diff);
        const rating = ruin.avg_rating ? Number(ruin.avg_rating).toFixed(1) : '暂无';

        let imagesHtml = '';
        if (ruin.images && ruin.images.length > 0) {
            imagesHtml = '<div class="detail-images">';
            ruin.images.forEach(img => {
                const uploader = img.username || '未知用户';
                const time = img.uploaded_at ? new Date(img.uploaded_at).toLocaleDateString('zh-CN') : '';
                imagesHtml += `
                    <div class="detail-image-item">
                        <img src="${img.file_path}" onclick="window.open('${img.file_path}')" alt="${img.description || ''}" />
                        <div class="detail-image-meta">
                            <span class="img-uploader">📷 ${this.escapeHtml(uploader)}</span>
                            ${time ? `<span class="img-time">${time}</span>` : ''}
                        </div>
                        ${img.description ? `<div class="img-desc">${this.escapeHtml(img.description)}</div>` : ''}
                    </div>
                `;
            });
            imagesHtml += '</div>';
        } else {
            imagesHtml = '<p style="color:#999;">暂无图片</p>';
        }

        let reviewsHtml = '';
        if (reviews.length > 0) {
            reviewsHtml = reviews.map(r => {
                // 自己的评价或管理员可显示删除按钮
                const canDelete = Auth.isLoggedIn() && (Auth.isAdmin() || r.user_id == Auth.user.id);
                const deleteBtn = canDelete
                    ? `<button class="btn btn-danger btn-sm review-delete-btn" onclick="App.deleteReview(${r.id}, ${id})">删除</button>`
                    : '';
                return `
                <div class="review-item">
                    <div class="review-header">
                        <span class="review-user">${this.escapeHtml(r.username)}</span>
                        <span class="review-rating">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                    </div>
                    <div class="review-content">${this.escapeHtml(r.content || '未填写评价内容')}</div>
                    <div class="review-footer">
                        <span class="review-time">${new Date(r.created_at).toLocaleString('zh-CN')}</span>
                        ${deleteBtn}
                    </div>
                </div>
                `;
            }).join('');
        } else {
            reviewsHtml = '<p style="color:#999;">暂无评价</p>';
        }

        const reviewFormHtml = Auth.isLoggedIn() ? `
            <div class="detail-section">
                <h3>添加评价</h3>
                <div class="form-group">
                    <label>评分</label>
                    <div class="star-rating" id="reviewStars">
                        <span class="star" data-value="1">★</span>
                        <span class="star" data-value="2">★</span>
                        <span class="star" data-value="3">★</span>
                        <span class="star" data-value="4">★</span>
                        <span class="star" data-value="5">★</span>
                    </div>
                    <input type="hidden" id="reviewRating" value="5" />
                </div>
                <div class="form-group">
                    <label>评价内容（选填）</label>
                    <textarea id="reviewContent" rows="2" placeholder="说说你的探索体验..."></textarea>
                </div>
                <button class="btn btn-primary btn-full" onclick="App.submitReview(${ruin.id})">提交评价</button>
            </div>
        ` : '<p style="color:#999;">请登录后评价</p>';

        const addImageHtml = Auth.isLoggedIn() ? `
            <div class="detail-section">
                <h3>添加图片</h3>
                <input type="file" id="addImageInput" accept="image/*" multiple />
                <button class="btn btn-accent btn-full" style="margin-top:8px;" onclick="App.addImageToRuin(${ruin.id})">上传图片</button>
            </div>
        ` : '';

        // 用 == 宽松比较, 因为 JWT 解出的 id 是数字, 数据库返回的可能是字符串
        const isOwner = Auth.isLoggedIn() && (Auth.user.id == ruin.user_id);
        const canManage = Auth.isLoggedIn() && (Auth.isAdmin() || isOwner);

        content.innerHTML = `
            <span class="modal-close" data-modal="detailModal">&times;</span>
            <h2>${ruin.name}</h2>

            <div class="detail-section">
                <div>
                    <span class="tag tag-category">${ruin.category}</span>
                    <span class="tag tag-difficulty">难度 ${stars}</span>
                    ${ruin.has_security === 1 ? '<span class="tag tag-security">有保安</span>' : ruin.has_security === 0 ? '<span class="tag" style="background:#27ae60;">无保安</span>' : '<span class="tag" style="background:#7f8c8d;">保安不确定</span>'}
                    ${ruin.has_dogs === 1 ? '<span class="tag tag-dogs">有狗</span>' : ruin.has_dogs === 0 ? '<span class="tag" style="background:#27ae60;">无狗</span>' : '<span class="tag" style="background:#7f8c8d;">狗不确定</span>'}
                    ${ruin.is_sensitive === 1 ? '<span class="tag tag-sensitive">敏感地点</span>' : ruin.is_sensitive === 0 ? '<span class="tag" style="background:#27ae60;">非敏感</span>' : '<span class="tag" style="background:#7f8c8d;">敏感性不确定</span>'}
                </div>
            </div>

            <div class="detail-section">
                <h3>基本信息</h3>
                <div class="detail-info">
                    <div class="info-item">
                        <span class="info-label">坐标</span>
                        <span class="info-value">${ruin.latitude.toFixed(5)}, ${ruin.longitude.toFixed(5)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">评分</span>
                        <span class="info-value">${rating} (${ruin.review_count}人评价)</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">上传者</span>
                        <span class="info-value">${ruin.author}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">上传时间</span>
                        <span class="info-value">${new Date(ruin.created_at).toLocaleDateString('zh-CN')}</span>
                    </div>
                    ${ruin.country ? `<div class="info-item"><span class="info-label">国家</span><span class="info-value">${ruin.country}</span></div>` : ''}
                    ${ruin.province ? `<div class="info-item"><span class="info-label">省份</span><span class="info-value">${ruin.province}</span></div>` : ''}
                    ${ruin.city ? `<div class="info-item"><span class="info-label">城市</span><span class="info-value">${ruin.city}</span></div>` : ''}
                    ${ruin.district ? `<div class="info-item"><span class="info-label">区县</span><span class="info-value">${ruin.district}</span></div>` : ''}
                </div>
            </div>

            ${ruin.description ? `
            <div class="detail-section">
                <h3>说明</h3>
                <div class="detail-description">${ruin.description}</div>
            </div>
            ` : ''}

            ${ruin.route ? `
            <div class="detail-section">
                <h3>路线</h3>
                <div class="detail-description">${ruin.route}</div>
            </div>
            ` : ''}

            ${ruin.external_link ? `
            <div class="detail-section">
                <h3>外链附件</h3>
                <a href="${ruin.external_link}" target="_blank" rel="noopener noreferrer" class="detail-link">🔗 ${ruin.external_link}</a>
            </div>
            ` : ''}

            <div class="detail-section">
                <h3>图片</h3>
                ${imagesHtml}
            </div>

            ${addImageHtml}

            <div class="detail-section">
                <h3>评价 (${reviews.length})</h3>
                ${reviewsHtml}
            </div>

            ${reviewFormHtml}

            <div class="detail-section" style="display:flex;gap:8px;">
                <button class="btn btn-primary btn-full" onclick="MapModule.flyTo(${ruin.latitude}, ${ruin.longitude}, 18); document.getElementById('detailModal').style.display='none';">在地图上查看</button>
                ${canManage ? `<button class="btn btn-accent btn-full" onclick="App.openEditRuin(${ruin.id})">编辑废墟</button>` : ''}
                ${canManage ? `<button class="btn btn-danger btn-full" onclick="App.deleteRuin(${ruin.id})">删除废墟</button>` : ''}
            </div>
            ${Auth.isAdmin() ? '<div style="text-align:center;color:#8e44ad;font-size:12px;margin-top:6px;">🔐 管理员模式 - 可管理所有废墟</div>' : ''}
        `;

        // 绑定弹窗关闭和评价星级
        content.querySelector('.modal-close').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // 评价星级
        let reviewRating = 5;
        const reviewStars = document.querySelectorAll('#reviewStars .star');
        reviewStars.forEach(star => {
            star.addEventListener('click', () => {
                reviewRating = parseInt(star.dataset.value);
                document.getElementById('reviewRating').value = reviewRating;
                reviewStars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.value) <= reviewRating));
            });
        });
        // 默认5星
        reviewStars.forEach(s => s.classList.add('active'));

        modal.style.display = 'flex';
    },

    // 提交评价
    async submitReview(ruinId) {
        const rating = parseInt(document.getElementById('reviewRating').value);
        const content = document.getElementById('reviewContent').value.trim();

        if (!content) {
            this.toast('评价内容不能为空', 'error');
            return;
        }

        try {
            await Ruins.createReview(ruinId, rating, content);
            this.toast('评价成功！', 'success');
            this.showDetail(ruinId);
            await this.loadRuins();
        } catch (err) {
            this.toast(err.message, 'error');
        }
    },

    // 删除评价(自己的或管理员删除任意)
    async deleteReview(reviewId, ruinId) {
        if (!confirm('确定要删除这条评价吗？')) return;
        try {
            await Ruins.deleteReview(reviewId);
            this.toast('评价已删除', 'success');
            this.showDetail(ruinId);
            await this.loadRuins();
        } catch (err) {
            this.toast(err.message, 'error');
        }
    },

    // 给废墟添加图片
    async addImageToRuin(ruinId) {
        const input = document.getElementById('addImageInput');
        if (!input.files.length) {
            this.toast('请选择图片', 'error');
            return;
        }
        try {
            for (const file of input.files) {
                const path = await Ruins.uploadImage(file);
                await Ruins.addImage(ruinId, path, '');
            }
            this.toast('图片添加成功！', 'success');
            this.showDetail(ruinId);
        } catch (err) {
            this.toast(err.message, 'error');
        }
    },

    // 删除废墟
    async deleteRuin(id) {
        if (!confirm('确定要删除这个废墟吗？此操作不可撤销。')) return;
        try {
            const res = await fetch(`${API_BASE}/api/ruins/` + id, {
                method: 'DELETE',
                headers: Auth.getAuthHeader()
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '删除失败');
            this.toast('删除成功', 'success');
            document.getElementById('detailModal').style.display = 'none';
            await this.loadRuins();
        } catch (err) {
            this.toast(err.message, 'error');
        }
    },

    // 编辑废墟(管理员或所有者)
    async openEditRuin(id) {
        try {
            const ruin = await Ruins.fetchById(id);
            // 关闭详情弹窗
            document.getElementById('detailModal').style.display = 'none';
            // 打开上传表单(复用)
            this.openRuinModal();
            // 修改标题
            document.querySelector('#ruinModal h2').textContent = '编辑废墟';
            // 填充已有数据
            document.getElementById('ruinName').value = ruin.name;
            document.getElementById('ruinCategory').value = ruin.category;
            document.getElementById('ruinLat').value = ruin.latitude;
            document.getElementById('ruinLng').value = ruin.longitude;
            document.getElementById('ruinDescription').value = ruin.description || '';
            document.getElementById('ruinSecurity').value = ruin.has_security;
            document.getElementById('ruinDogs').value = ruin.has_dogs;
            this.setDifficulty(ruin.difficulty);
            document.getElementById('ruinRoute').value = ruin.route || '';
            document.getElementById('ruinExternalLink').value = ruin.external_link || '';
            document.getElementById('ruinSensitive').value = ruin.is_sensitive;
            document.getElementById('ruinPublic').value = ruin.is_public;
            document.getElementById('ruinCountry').value = ruin.country || '';
            document.getElementById('ruinProvince').value = ruin.province || '';
            document.getElementById('ruinCity').value = ruin.city || '';
            document.getElementById('ruinDistrict').value = ruin.district || '';

            // 标记为编辑模式
            this.editingRuinId = id;
            // 修改提交按钮文字
            const submitBtn = document.querySelector('#ruinForm button[type="submit"]');
            submitBtn.textContent = '保存修改';
        } catch (err) {
            this.toast(err.message, 'error');
        }
    },

    // === 侧边栏 ===
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const expandBtn = document.getElementById('expandSidebar');
        if (sidebar.classList.contains('collapsed')) {
            sidebar.classList.remove('collapsed');
            expandBtn.style.display = 'none';
        } else {
            sidebar.classList.add('collapsed');
            expandBtn.style.display = 'block';
        }
        setTimeout(() => MapModule.map.invalidateSize(), 300);
    },

    // === CSV 批量导入 ===

    // 打开 CSV 导入弹窗
    openCsvImport() {
        if (!Auth.isLoggedIn()) {
            this.toast('请先登录', 'error');
            this.openAuthModal('login');
            return;
        }
        document.getElementById('csvFileInput').value = '';
        document.getElementById('csvListSection').style.display = 'none';
        document.getElementById('csvImportList').innerHTML = '';
        this.csvImportItems = [];
        document.getElementById('csvImportModal').style.display = 'flex';
    },

    // 简单 CSV 解析(支持引号包裹和转义双引号)
    parseCSV(text) {
        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
        if (lines.length < 2) return { headers: [], rows: [] };

        const parseLine = (line) => {
            const result = [];
            let cur = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (inQuotes) {
                    if (ch === '"') {
                        if (line[i + 1] === '"') { cur += '"'; i++; }
                        else inQuotes = false;
                    } else cur += ch;
                } else {
                    if (ch === '"') inQuotes = true;
                    else if (ch === ',') { result.push(cur); cur = ''; }
                    else cur += ch;
                }
            }
            result.push(cur);
            return result.map(s => s.trim());
        };

        const headers = parseLine(lines[0]).map(h => h.toLowerCase().trim());
        const rows = lines.slice(1).map(parseLine);
        return { headers, rows };
    },

    // 解析选中的 CSV 文件
    async handleCsvParse() {
        const fileInput = document.getElementById('csvFileInput');
        if (!fileInput.files.length) {
            this.toast('请先选择 CSV 文件', 'error');
            return;
        }
        const file = fileInput.files[0];
        const text = await file.text();
        const { headers, rows } = this.parseCSV(text);

        if (headers.length === 0 || rows.length === 0) {
            this.toast('CSV 文件为空或格式错误', 'error');
            return;
        }

        // 表头字段映射(支持中英文)
        const fieldMap = {
            'name': 'name', '名称': 'name', '废墟名称': 'name',
            'category': 'category', '类别': 'category', '废墟类别': 'category',
            'latitude': 'latitude', 'lat': 'latitude', '纬度': 'latitude',
            'longitude': 'longitude', 'lng': 'longitude', 'lon': 'longitude', '经度': 'longitude',
            'description': 'description', '说明': 'description', '描述': 'description',
            'has_security': 'has_security', '保安': 'has_security', '有保安': 'has_security',
            'has_dogs': 'has_dogs', '狗': 'has_dogs', '有狗': 'has_dogs',
            'difficulty': 'difficulty', '难度': 'difficulty',
            'route': 'route', '路线': 'route',
            'is_sensitive': 'is_sensitive', '敏感': 'is_sensitive',
            'is_public': 'is_public', '公开': 'is_public',
            'country': 'country', '国家': 'country',
            'province': 'province', '省份': 'province',
            'city': 'city', '城市': 'city',
            'district': 'district', '区县': 'district',
            'external_link': 'external_link', '外链': 'external_link', '链接': 'external_link'
        };

        this.csvImportItems = rows.map((row, idx) => {
            const obj = { _idx: idx, _status: 'pending', _error: '' };
            headers.forEach((h, i) => {
                const key = fieldMap[h] || h;
                obj[key] = row[i] !== undefined ? row[i] : '';
            });
            return obj;
        });

        this.renderCsvList();
        document.getElementById('csvListSection').style.display = 'block';
        this.toast(`解析完成，共 ${this.csvImportItems.length} 条数据`, 'success');
    },

    // HTML 转义
    escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    // 渲染 CSV 列表(每条可编辑)
    renderCsvList() {
        const list = document.getElementById('csvImportList');
        const stats = document.getElementById('csvStats');
        const success = this.csvImportItems.filter(i => i._status === 'ok').length;
        const failed = this.csvImportItems.filter(i => i._status === 'error').length;
        const pending = this.csvImportItems.filter(i => i._status === 'pending').length;
        stats.textContent = `共 ${this.csvImportItems.length} 条 | 成功 ${success} | 失败 ${failed} | 待上传 ${pending}`;

        const categories = ['废弃医院', '废弃酒店', '废弃学校', '废弃工厂', '废弃住宅', '废弃公园', '废弃商场', '废弃教堂', '废弃车站', '其他'];

        list.innerHTML = this.csvImportItems.map((item, idx) => {
            const statusClass = `status-${item._status}`;
            const statusText = item._status === 'pending' ? '待上传' : (item._status === 'ok' ? '已上传' : '失败');
            return `
                <div class="csv-import-item">
                    <div class="csv-item-header">
                        <strong>#${idx + 1}</strong>
                        <span class="csv-item-status ${statusClass}">${statusText}</span>
                    </div>
                    ${item._error ? `<div style="color:#e74c3c;font-size:11px;margin-bottom:4px;">${this.escapeHtml(item._error)}</div>` : ''}
                    <div class="form-row">
                        <div class="form-group">
                            <label>名称 *</label>
                            <input type="text" data-idx="${idx}" data-field="name" value="${this.escapeHtml(item.name)}" />
                        </div>
                        <div class="form-group">
                            <label>类别 *</label>
                            <select data-idx="${idx}" data-field="category">
                                ${categories.map(c => `<option value="${c}" ${item.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>纬度 *</label>
                            <input type="number" step="0.000001" data-idx="${idx}" data-field="latitude" value="${this.escapeHtml(item.latitude)}" />
                        </div>
                        <div class="form-group">
                            <label>经度 *</label>
                            <input type="number" step="0.000001" data-idx="${idx}" data-field="longitude" value="${this.escapeHtml(item.longitude)}" />
                        </div>
                    </div>
                    <div class="form-group">
                        <label>说明</label>
                        <input type="text" data-idx="${idx}" data-field="description" value="${this.escapeHtml(item.description)}" />
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>保安</label>
                            <select data-idx="${idx}" data-field="has_security">
                                <option value="2" ${item.has_security == 2 ? 'selected' : ''}>不确定</option>
                                <option value="0" ${item.has_security == 0 ? 'selected' : ''}>无</option>
                                <option value="1" ${item.has_security == 1 ? 'selected' : ''}>有</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>狗</label>
                            <select data-idx="${idx}" data-field="has_dogs">
                                <option value="2" ${item.has_dogs == 2 ? 'selected' : ''}>不确定</option>
                                <option value="0" ${item.has_dogs == 0 ? 'selected' : ''}>无</option>
                                <option value="1" ${item.has_dogs == 1 ? 'selected' : ''}>有</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>难度</label>
                            <select data-idx="${idx}" data-field="difficulty">
                                ${[1, 2, 3, 4, 5].map(d => `<option value="${d}" ${item.difficulty == d ? 'selected' : ''}>${'★'.repeat(d)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>路线</label>
                        <input type="text" data-idx="${idx}" data-field="route" value="${this.escapeHtml(item.route)}" />
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>敏感</label>
                            <select data-idx="${idx}" data-field="is_sensitive">
                                <option value="2" ${item.is_sensitive == 2 ? 'selected' : ''}>不确定</option>
                                <option value="0" ${item.is_sensitive == 0 ? 'selected' : ''}>否</option>
                                <option value="1" ${item.is_sensitive == 1 ? 'selected' : ''}>是</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>公开</label>
                            <select data-idx="${idx}" data-field="is_public">
                                <option value="1" ${item.is_public != 0 ? 'selected' : ''}>公开</option>
                                <option value="0" ${item.is_public == 0 ? 'selected' : ''}>仅自己</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>国家</label>
                            <input type="text" data-idx="${idx}" data-field="country" value="${this.escapeHtml(item.country)}" />
                        </div>
                        <div class="form-group">
                            <label>省份</label>
                            <input type="text" data-idx="${idx}" data-field="province" value="${this.escapeHtml(item.province)}" />
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>城市</label>
                            <input type="text" data-idx="${idx}" data-field="city" value="${this.escapeHtml(item.city)}" />
                        </div>
                        <div class="form-group">
                            <label>区县</label>
                            <input type="text" data-idx="${idx}" data-field="district" value="${this.escapeHtml(item.district)}" />
                        </div>
                    </div>
                    <div class="form-group">
                        <label>外链</label>
                        <input type="url" data-idx="${idx}" data-field="external_link" value="${this.escapeHtml(item.external_link)}" />
                    </div>
                    <button type="button" class="btn btn-primary btn-full" onclick="App.uploadCsvItem(${idx})">上传此条</button>
                </div>
            `;
        }).join('');

        // 绑定字段变更事件
        list.querySelectorAll('input, select, textarea').forEach(el => {
            el.addEventListener('change', () => {
                const idx = parseInt(el.dataset.idx);
                const field = el.dataset.field;
                if (this.csvImportItems[idx]) {
                    this.csvImportItems[idx][field] = el.value;
                }
            });
        });
    },

    // 上传单条 CSV 数据
    async uploadCsvItem(idx) {
        const item = this.csvImportItems[idx];
        if (!item) return;

        // 验证必填
        if (!item.name || !item.category || item.latitude === '' || item.longitude === '' || item.latitude == null || item.longitude == null) {
            item._status = 'error';
            item._error = '名称、类别、纬度、经度不能为空';
            this.renderCsvList();
            this.toast(`#${idx + 1} 请填写必填字段`, 'error');
            return;
        }

        const data = {
            name: item.name,
            category: item.category,
            latitude: parseFloat(item.latitude),
            longitude: parseFloat(item.longitude),
            description: item.description || '',
            has_security: parseInt(item.has_security) || 2,
            has_dogs: parseInt(item.has_dogs) || 2,
            difficulty: parseInt(item.difficulty) || 1,
            route: item.route || '',
            is_sensitive: parseInt(item.is_sensitive) || 2,
            is_public: item.is_public !== '0' && item.is_public !== 0,
            country: item.country || '',
            province: item.province || '',
            city: item.city || '',
            district: item.district || '',
            external_link: item.external_link || '',
        };

        try {
            await Ruins.create(data);
            item._status = 'ok';
            item._error = '';
            this.renderCsvList();
            this.toast(`#${idx + 1} 上传成功`, 'success');
            await this.loadRuins();
        } catch (err) {
            item._status = 'error';
            item._error = err.message;
            this.renderCsvList();
            this.toast(`#${idx + 1} 上传失败: ${err.message}`, 'error');
        }
    },

    // 批量上传所有待上传数据
    async uploadAllCsv() {
        const pending = this.csvImportItems.filter(i => i._status === 'pending');
        if (pending.length === 0) {
            this.toast('没有待上传的数据', 'error');
            return;
        }
        this.toast(`开始上传 ${pending.length} 条数据...`, 'success');
        for (const item of pending) {
            await this.uploadCsvItem(item._idx);
        }
        const failed = this.csvImportItems.filter(i => i._status === 'error').length;
        if (failed === 0) {
            this.toast('全部上传完成', 'success');
        } else {
            this.toast(`上传完成，${failed} 条失败，请检查后重试`, 'error');
        }
    },

    // 下载 CSV 模板
    downloadCsvTemplate() {
        const headers = 'name,category,latitude,longitude,description,has_security,has_dogs,difficulty,route,is_sensitive,is_public,country,province,city,district,external_link';
        const example = '示例废弃工厂,废弃工厂,23.1291,113.2644,一个老工厂,2,2,3,从东门进入,0,1,中国,广东省,广州市,天河区,https://example.com';
        const csv = '\uFEFF' + headers + '\n' + example;  // BOM 防止 Excel 中文乱码
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '废墟导入模板.csv';
        a.click();
        URL.revokeObjectURL(url);
        this.toast('模板已下载', 'success');
    },

    // === Toast 提示 ===
    toast(message, type = '') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast ' + type + ' show';
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
};

// 启动应用
document.addEventListener('DOMContentLoaded', () => App.init());
