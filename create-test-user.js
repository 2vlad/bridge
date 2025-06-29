const { readUsers, writeUsers } = require('./services/users');
const bcrypt = require('bcryptjs');

// Создаем тестового пользователя для проверки функционала
async function createTestUser() {
    console.log('🧪 Создание тестового пользователя...');
    
    const users = readUsers();
    
    // Проверяем, есть ли уже тестовый пользователь
    const existingTestUser = users.find(u => u.email === 'test@lightphone.dev');
    
    if (existingTestUser) {
        console.log('⚠️ Тестовый пользователь уже существует, обновляем настройки...');
        
        // Обновляем настройки существующего пользователя
        existingTestUser.settings = {
            lightPhoneEmail: 'YOUR_LIGHT_PHONE_EMAIL_HERE',
            lightPhonePassword: 'YOUR_LIGHT_PHONE_PASSWORD_HERE',
            trigger: '<' // Триггер для обработки заметок
        };
        
        writeUsers(users);
        
        console.log('✅ Настройки тестового пользователя обновлены');
        console.log('📝 Теперь измените данные в data/users.json на реальные:');
        console.log('   - lightPhoneEmail: ваш email от Light Phone');
        console.log('   - lightPhonePassword: ваш пароль от Light Phone');
        
    } else {
        // Создаем нового тестового пользователя
        const newUser = {
            id: `test-${Date.now()}`,
            email: 'test@lightphone.dev',
            password: await bcrypt.hash('test123', 8),
            name: 'Test User',
            settings: {
                lightPhoneEmail: 'YOUR_LIGHT_PHONE_EMAIL_HERE',
                lightPhonePassword: 'YOUR_LIGHT_PHONE_PASSWORD_HERE',
                trigger: '<' // Триггер для обработки заметок
            },
            created: new Date().toISOString()
        };
        
        users.push(newUser);
        writeUsers(users);
        
        console.log('✅ Тестовый пользователь создан');
        console.log(`📧 Email: ${newUser.email}`);
        console.log(`🔑 Пароль: test123`);
        console.log(`🆔 ID: ${newUser.id}`);
        
        console.log('\n📝 Теперь измените данные в data/users.json на реальные:');
        console.log('   - lightPhoneEmail: ваш email от Light Phone');
        console.log('   - lightPhonePassword: ваш пароль от Light Phone');
    }
    
    console.log('\n🚀 После обновления данных запустите:');
    console.log('   npm run start:optimized');
    console.log('\n🔍 Или протестируйте локально:');
    console.log('   node test-optimized-worker.js');
}

if (require.main === module) {
    createTestUser().catch(console.error);
}

module.exports = { createTestUser }; 