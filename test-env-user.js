// Тест создания пользователя из переменных окружения
const { readUsers } = require('./services/users');

function testEnvUserLogic() {
    console.log('🧪 Тестирование логики переменных окружения...');
    
    const allUsers = readUsers();
    console.log(`👥 Пользователей в базе: ${allUsers.length}`);
    
    // Проверяем есть ли пользователи с настройками Light Phone
    const usersWithLightPhone = allUsers.filter(u => u.settings?.lightPhoneEmail);
    console.log(`📱 Пользователей с Light Phone настройками: ${usersWithLightPhone.length}`);
    
    // Симуляция логики из optimized-main.js
    const testUsers = [...allUsers];
    
    // Создаем виртуального пользователя из переменных окружения если настоящих нет
    if (testUsers.length === 0 || !testUsers.some(u => u.settings?.lightPhoneEmail)) {
        if (process.env.LIGHT_PHONE_EMAIL && process.env.LIGHT_PHONE_PASSWORD && process.env.CLAUDE_API_KEY) {
            console.log('📧 Создаем виртуального пользователя из переменных окружения');
            const envUser = {
                id: 'env-user',
                email: process.env.LIGHT_PHONE_EMAIL,
                settings: {
                    lightPhoneEmail: process.env.LIGHT_PHONE_EMAIL,
                    lightPhonePassword: process.env.LIGHT_PHONE_PASSWORD,
                    claudeApiKey: process.env.CLAUDE_API_KEY,
                    trigger: '<'
                }
            };
            testUsers.push(envUser);
        } else {
            console.log('❌ Недостаточно переменных окружения для создания виртуального пользователя');
            console.log(`   LIGHT_PHONE_EMAIL: ${process.env.LIGHT_PHONE_EMAIL ? '✅' : '❌'}`);
            console.log(`   LIGHT_PHONE_PASSWORD: ${process.env.LIGHT_PHONE_PASSWORD ? '✅' : '❌'}`);
            console.log(`   CLAUDE_API_KEY: ${process.env.CLAUDE_API_KEY ? '✅' : '❌'}`);
        }
    } else {
        console.log('📱 Найдены пользователи с Light Phone настройками в базе, переменные окружения не используются');
    }
    
    const activeUsers = testUsers.filter(u => 
        u.settings?.lightPhoneEmail && 
        u.settings?.lightPhonePassword &&
        (u.settings?.claudeApiKey || process.env.CLAUDE_API_KEY)
    );
    
    console.log(`\n👤 Итого активных пользователей: ${activeUsers.length}`);
    activeUsers.forEach((u, index) => {
        const source = u.id === 'env-user' ? 'ENV' : 'DB';
        console.log(`   ${index + 1}. ${u.email} (${u.id}) [${source}]`);
    });
    
    return activeUsers.length > 0;
}

if (require.main === module) {
    const success = testEnvUserLogic();
    console.log(`\n${success ? '✅' : '❌'} Тест ${success ? 'успешен' : 'неуспешен'}`);
}

module.exports = { testEnvUserLogic }; 