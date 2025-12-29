import os

# 你的图片根目录，例如 './source/img'
target_dir = './post'

def batch_rename(path):
    # topdown=False 非常重要：先改子文件/文件夹，再改父文件夹
    for root, dirs, files in os.walk(path, topdown=False):
        # 1. 重命名文件
        for name in files:
            if ' ' in name:
                new_name = name.replace(' ', '-')
                old_path = os.path.join(root, name)
                new_path = os.path.join(root, new_name)
                os.rename(old_path, new_path)
                print(f"文件重命名: {name} -> {new_name}")

        # 2. 重命名文件夹
        for name in dirs:
            if ' ' in name:
                new_name = name.replace(' ', '-')
                old_path = os.path.join(root, name)
                new_path = os.path.join(root, new_name)
                os.rename(old_path, new_path)
                print(f"文件夹重命名: {name} -> {new_name}")

if __name__ == "__main__":
    # 执行前建议先备份！
    batch_rename(target_dir)
    print("完成！")