from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('expenses', '0006_add_receipt_data'),
    ]

    operations = [
        migrations.AddField(
            model_name='expense',
            name='category',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('food',          'Food & Dining'),
                    ('transport',     'Transport'),
                    ('entertainment', 'Entertainment'),
                    ('shopping',      'Shopping'),
                    ('housing',       'Housing & Utilities'),
                    ('health',        'Health & Fitness'),
                    ('travel',        'Travel'),
                    ('other',         'Other'),
                ],
                default='other',
            ),
        ),
    ]
