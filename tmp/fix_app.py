import os

file_path = 'src/App.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find('{editingUser && (', 270000)
end_idx = content.find('</AnimatePresence>', start_idx) + len('</AnimatePresence>')

print('Found start_idx:', start_idx)
print('Found end_idx:', end_idx)

replacement = """{editingUser && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="px-2"
                  >
                    <form onSubmit={handleUpdateUser} className="bg-bg/50 p-6 md:p-8 rounded-[2.5rem] border border-accent/10 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">تعديل الاسم</label>
                          <input required type="text" value={editingUser.name || ''} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="input-field" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">البريد (ثابت)</label>
                          <input disabled type="email" value={editingUser.email || ''} className="input-field opacity-50 bg-bg" />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">تعديل الدور</label>
                          <select value={editingUser.role || 'representative'} onChange={e => setEditingUser({...editingUser, role: e.target.value as Role})} className="input-field appearance-none">
                            {Object.entries(roleLabels)
                              .filter(([val]) => val !== 'developer' || profile?.role === 'developer')
                              .map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">كلمة المرور</label>
                          <input required type="text" value={editingUser.password || ''} onChange={e => setEditingUser({...editingUser, password: e.target.value})} className="input-field" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">الراتب الثابت</label>
                            <input required type="number" value={editingUser.baseSalary || ''} onChange={e => setEditingUser({...editingUser, baseSalary: parseFloat(e.target.value) || 0})} className="input-field" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">نوع الراتب</label>
                            <select value={editingUser.salaryType || 'monthly'} onChange={e => setEditingUser({...editingUser, salaryType: e.target.value as 'daily' | 'monthly'})} className="input-field appearance-none">
                              <option value="monthly">شهري ثابت</option>
                              <option value="daily">يومي (حسب الحضور)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-1.5 px-1">عمولة التارجت (عند 100%)</label>
                            <input required type="number" value={editingUser.targetBonus || ''} onChange={e => setEditingUser({...editingUser, targetBonus: parseFloat(e.target.value) || 0})} className="input-field" />
                          </div>
                        </div>
                        <div className="pt-2 flex gap-3">
                          <button type="submit" className="flex-1 btn-primary flex items-center justify-center gap-2">
                            <Check size={18} />
                            حفظ التعديلات
                          </button>
                          <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-3 bg-white text-secondary border border-accent/10 rounded-2xl font-bold active:scale-95">
                            إلغاء
                          </button>
                        </div>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>"""

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + replacement + content[end_idx:]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('SUCCESS: Replacement successful!')
else:
    print('ERROR: indices not found!')
