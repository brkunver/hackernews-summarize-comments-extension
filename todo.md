# Yapılması gerekenler

- Eklentinin ayarlar menüsünde yeni google modeli string olarak eklenebilmeli. mesela kullanıcı "gemini-flash-lite-3.5" gibi bir modeli ekleyebilmeli ve bu model eklenti tarafından kullanılabilmeli. Ve modelleri silebilmeli de. Ama şimdilik sadece bunu google modelleri için yapalım. Yani eklenti sadece google modellerini desteklesin. OpenAI veya başka bir model eklemeye gerek yok.

- Yorum seçme : Eğer ki toplam yorum sayısı ayarlarda belirtilen maksimum yorum sayısını aşarsa, eklenti rastgele yorumları seçip kullanabilmeli. Bunu ayarlara ekleyebilmeliyiz. eğer açıksa yorumlar rastgele seçilecek, eğer kapalıysa lineer olarak defalult random olsun

- Maximum depth seçme : normalde bildiğin gibi hackernewsde yorumlara bir daha yorum atılabiliyor. bunun için kaç maksimum iç içe yorumu destekleyeceğini ayarlarda belirleyebilmeliyiz. Örneğin 1 Derinlik demek sadece yorumları al demek, 2 Derinlik demek yorumların altındaki yorumları da almak demek. Bu ayar sayesinde eklenti daha derin yorumları alabilir veya sadece yüzeysel yorumları alabilir. Default 2 olsun

- yapılacaklar bitince hata düzeltme ve quality of life iyileştirmeleri yapılacak.
